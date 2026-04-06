import type { Request, Response } from "express";

import { getRequestMetadata } from "../../../utils/request-metadata";
import { complaintsService } from "../services/complaints.service";

export const complaintsController = {
  async listMyComplaints(request: Request, response: Response) {
    const complaints = await complaintsService.listMyComplaints(request.auth!.user);
    response.status(200).json({ complaints });
  },

  async getComplaintById(request: Request, response: Response) {
    const complaint = await complaintsService.getComplaintById(
      request.auth!.user,
      String(request.params.complaintId),
    );

    response.status(200).json({ complaint });
  },

  async createComplaint(request: Request, response: Response) {
    const complaint = await complaintsService.createComplaint(
      request.auth!.user,
      request.body,
      request.file,
      getRequestMetadata(request),
    );

    response.status(201).json({ complaint });
  },

  async listReviewQueue(request: Request, response: Response) {
    const complaints = await complaintsService.listReviewQueue(
      request.auth!.user,
      request.query,
    );

    response.status(200).json({ complaints });
  },

  async startReview(request: Request, response: Response) {
    const complaint = await complaintsService.startReview(
      request.auth!.user,
      String(request.params.complaintId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ complaint });
  },

  async routeComplaint(request: Request, response: Response) {
    const complaint = await complaintsService.routeComplaint(
      request.auth!.user,
      String(request.params.complaintId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ complaint });
  },

  async escalateComplaint(request: Request, response: Response) {
    const complaint = await complaintsService.escalateComplaint(
      request.auth!.user,
      String(request.params.complaintId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ complaint });
  },

  async resolveComplaint(request: Request, response: Response) {
    const complaint = await complaintsService.resolveComplaint(
      request.auth!.user,
      String(request.params.complaintId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ complaint });
  },

  async closeComplaint(request: Request, response: Response) {
    const complaint = await complaintsService.closeComplaint(
      request.auth!.user,
      String(request.params.complaintId),
      request.body,
      getRequestMetadata(request),
    );

    response.status(200).json({ complaint });
  },
};
