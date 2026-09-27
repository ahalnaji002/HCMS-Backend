const resourceAllocationService = require("../services/resourceAllocationService");
const formatDateOnly = require("../utils/formatDateOnly");

function serializeAllocation(allocation) {
  return {
    ...allocation,
    delivery_date:
      allocation.delivery_date === null
        ? null
        : formatDateOnly(allocation.delivery_date),
  };
}

function serializeAllocations(allocations) {
  return allocations.map(serializeAllocation);
}

function handleResourceAllocationError(error, res) {
  if (error instanceof resourceAllocationService.ResourceAllocationForbiddenError) {
    return res.status(403).json({ success: false, message: error.message });
  }

  if (error instanceof resourceAllocationService.ResourceAllocationNotFoundError) {
    return res.status(404).json({ success: false, message: error.message });
  }

  if (error instanceof resourceAllocationService.ResourceAllocationConflictError) {
    return res.status(409).json({ success: false, message: error.message });
  }

  console.error("Resource Allocation error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

async function createForNgo(req, res) {
  try {
    const allocation = await resourceAllocationService.createForNgo(
      req.user,
      req.validatedResourceRequestId,
      req.validatedResourceAllocation,
      req.ip,
    );

    return res.status(201).json({
      success: true,
      message: "Resource Allocation created successfully",
      data: { resource_allocation: serializeAllocation(allocation) },
    });
  } catch (error) {
    return handleResourceAllocationError(error, res);
  }
}

async function listForNgo(req, res) {
  try {
    const allocations = await resourceAllocationService.listForNgo(
      req.user,
      req.validatedResourceRequestId,
    );
    return res.status(200).json({
      success: true,
      message: "Resource Allocations retrieved successfully",
      data: { resource_allocations: serializeAllocations(allocations) },
    });
  } catch (error) {
    return handleResourceAllocationError(error, res);
  }
}

async function updateForNgo(req, res) {
  try {
    const allocation = await resourceAllocationService.updateForNgo(
      req.user,
      req.validatedResourceRequestId,
      req.validatedResourceId,
      req.validatedResourceAllocation,
      req.ip,
    );
    return res.status(200).json({
      success: true,
      message: "Resource Allocation updated successfully",
      data: { resource_allocation: serializeAllocation(allocation) },
    });
  } catch (error) {
    return handleResourceAllocationError(error, res);
  }
}

async function deleteForNgo(req, res) {
  try {
    const allocation = await resourceAllocationService.deleteForNgo(
      req.user,
      req.validatedResourceRequestId,
      req.validatedResourceId,
      req.ip,
    );
    return res.status(200).json({
      success: true,
      message: "Resource Allocation deleted successfully",
      data: { resource_allocation: serializeAllocation(allocation) },
    });
  } catch (error) {
    return handleResourceAllocationError(error, res);
  }
}

function buildListHandler(serviceFunction) {
  return async function listAllocations(req, res) {
    try {
      const allocations = await serviceFunction(
        req.user,
        req.validatedResourceRequestId,
      );
      return res.status(200).json({
        success: true,
        message: "Resource Allocations retrieved successfully",
        data: { resource_allocations: serializeAllocations(allocations) },
      });
    } catch (error) {
      return handleResourceAllocationError(error, res);
    }
  };
}

const listForPatient = buildListHandler(resourceAllocationService.listForPatient);
const listForDoctor = buildListHandler(resourceAllocationService.listForDoctor);
const listForAdmin = async function listForAdmin(req, res) {
  try {
    const allocations = await resourceAllocationService.listForAdmin(
      req.validatedResourceRequestId,
    );
    return res.status(200).json({
      success: true,
      message: "Resource Allocations retrieved successfully",
      data: { resource_allocations: serializeAllocations(allocations) },
    });
  } catch (error) {
    return handleResourceAllocationError(error, res);
  }
};

module.exports = {
  createForNgo,
  deleteForNgo,
  listForAdmin,
  listForDoctor,
  listForNgo,
  listForPatient,
  updateForNgo,
};
