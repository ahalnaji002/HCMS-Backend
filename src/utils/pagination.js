// Shared page/limit handling for list endpoints. Same query names and
// response fields as GET /api/admin/users: ?page=1&limit=20 in, and
// { page, limit, total, total_pages } next to the list out.

const PAGE_MAX = 1000000;
const LIMIT_MAX = 100;

function parsePositiveInteger(value, fieldName, maximum) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return `${fieldName} must be a positive integer`;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    return `${fieldName} must be a positive integer not greater than ${maximum}`;
  }
  return parsed;
}

/**
 * Builds middleware that reads `page` and `limit` into `req.pagination`.
 *
 * - `defaultLimit`: limit used when only `page` (or nothing) is sent.
 * - `optional: true`: when neither `page` nor `limit` is sent,
 *   `req.pagination` is `null` and the endpoint returns its full list as
 *   before. Used for admin lists whose dashboards still count client-side.
 *
 * Other query fields are left alone so existing filters keep working.
 */
function validatePagination({ defaultLimit = 20, optional = false } = {}) {
  return function paginationMiddleware(req, res, next) {
    const query = req.query ?? {};
    const hasPage = query.page !== undefined;
    const hasLimit = query.limit !== undefined;

    if (optional && !hasPage && !hasLimit) {
      req.pagination = null;
      return next();
    }

    const errors = {};
    let page = 1;
    let limit = defaultLimit;

    if (hasPage) {
      const parsed = parsePositiveInteger(query.page, "page", PAGE_MAX);
      if (typeof parsed === "string") errors.page = parsed;
      else page = parsed;
    }
    if (hasLimit) {
      const parsed = parsePositiveInteger(query.limit, "limit", LIMIT_MAX);
      if (typeof parsed === "string") errors.limit = parsed;
      else limit = parsed;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    req.pagination = { page, limit };
    return next();
  };
}

/**
 * Runs a list query one page at a time. `query` is a Knex builder with its
 * select and order already set; the total is counted from a copy of it
 * without select or order.
 */
async function paginateQuery(query, { page, limit }) {
  const countQuery = query
    .clone()
    .clearSelect()
    .clearOrder()
    .count({ total: "*" })
    .first();
  const [items, countRow] = await Promise.all([
    query.limit(limit).offset((page - 1) * limit),
    countQuery,
  ]);

  return { items, total: Number(countRow?.total ?? 0) };
}

function paginationMeta({ page, limit }, total) {
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit),
  };
}

/**
 * For lists where paging is optional: with `pagination` null the whole list
 * is returned and `meta` is empty, so the response keeps its old shape.
 */
async function listWithOptionalPagination(query, pagination) {
  if (!pagination) {
    return { items: await query, meta: {} };
  }

  const { items, total } = await paginateQuery(query, pagination);
  return { items, meta: paginationMeta(pagination, total) };
}

module.exports = {
  LIMIT_MAX,
  listWithOptionalPagination,
  paginateQuery,
  paginationMeta,
  validatePagination,
};
