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

async function createForNgo(req, res) {
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
}

async function listForNgo(req, res) {
  const allocations = await resourceAllocationService.listForNgo(
    req.user,
    req.validatedResourceRequestId,
  );
  return res.status(200).json({
    success: true,
    message: "Resource Allocations retrieved successfully",
    data: { resource_allocations: serializeAllocations(allocations) },
  });
}

async function updateForNgo(req, res) {
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
}

async function deleteForNgo(req, res) {
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
}

function buildListHandler(serviceFunction) {
  return async function listAllocations(req, res) {
    const allocations = await serviceFunction(
      req.user,
      req.validatedResourceRequestId,
    );
    return res.status(200).json({
      success: true,
      message: "Resource Allocations retrieved successfully",
      data: { resource_allocations: serializeAllocations(allocations) },
    });
  };
}

const listForPatient = buildListHandler(resourceAllocationService.listForPatient);
const listForDoctor = buildListHandler(resourceAllocationService.listForDoctor);
const listForAdmin = async function listForAdmin(req, res) {
  const allocations = await resourceAllocationService.listForAdmin(
    req.validatedResourceRequestId,
  );
  return res.status(200).json({
    success: true,
    message: "Resource Allocations retrieved successfully",
    data: { resource_allocations: serializeAllocations(allocations) },
  });
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
