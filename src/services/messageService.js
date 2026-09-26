const doctorModel = require("../models/doctorModel");
const doctorPatientAssignmentModel = require("../models/doctorPatientAssignmentModel");
const messageModel = require("../models/messageModel");
const patientModel = require("../models/patientModel");
const userModel = require("../models/userModel");
const db = require("../config/database");

class MessageNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "MessageNotFoundError";
  }
}

class MessageForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "MessageForbiddenError";
  }
}

async function getUserOrThrow(userId) {
  const user = await userModel.findById(userId);

  if (!user) {
    throw new MessageNotFoundError("User not found");
  }

  return user;
}

async function getMessagingProfiles(sender, receiver) {
  if (sender.role === "PATIENT" && receiver.role === "DOCTOR") {
    const [patient, doctor] = await Promise.all([
      patientModel.findByUserId(sender.id),
      doctorModel.findByUserId(receiver.id),
    ]);

    return { patient, doctor };
  }

  if (sender.role === "DOCTOR" && receiver.role === "PATIENT") {
    const [doctor, patient] = await Promise.all([
      doctorModel.findByUserId(sender.id),
      patientModel.findByUserId(receiver.id),
    ]);

    return { patient, doctor };
  }

  throw new MessageForbiddenError(
    "Messaging is allowed only between a Patient and a Doctor",
  );
}

async function sendMessage(sender, input) {
  const receiver = await getUserOrThrow(input.receiver_id);
  const { patient, doctor } = await getMessagingProfiles(sender, receiver);

  if (!patient || !doctor) {
    throw new MessageNotFoundError("Messaging participant profile not found");
  }

  return db.transaction(async (trx) => {
    // Match assignment status changes' doctor -> patient -> assignment order.
    await doctorModel.findByIdForUpdate(doctor.id, trx);
    await patientModel.findByIdForUpdate(patient.id, trx);

    const assignment =
      await doctorPatientAssignmentModel.findActiveByDoctorAndPatientForUpdate(
        doctor.id,
        patient.id,
        trx,
      );

    if (!assignment) {
      throw new MessageForbiddenError(
        "Active Doctor-Patient Assignment required",
      );
    }

    return messageModel.create(
      {
        sender_id: sender.id,
        receiver_id: receiver.id,
        message_text: input.message_text,
      },
      trx,
    );
  });
}

function listConversations(user) {
  return messageModel.listConversationSummaries(user.id);
}

async function getConversationHistory(user, otherUserId) {
  await getUserOrThrow(otherUserId);

  const messages = await messageModel.listBetweenUsers(user.id, otherUserId);

  if (messages.length === 0) {
    throw new MessageForbiddenError("Conversation access forbidden");
  }

  return messages;
}

async function markMessageRead(user, messageId) {
  const message = await messageModel.findById(messageId);

  if (!message) {
    throw new MessageNotFoundError("Message not found");
  }

  if (String(message.receiver_id) !== String(user.id)) {
    throw new MessageForbiddenError(
      "Only the message receiver may mark it as read",
    );
  }

  if (message.is_read) {
    return message;
  }

  return messageModel.markReadByIdAndReceiverId(messageId, user.id);
}

module.exports = {
  MessageForbiddenError,
  MessageNotFoundError,
  getConversationHistory,
  listConversations,
  markMessageRead,
  sendMessage,
};
