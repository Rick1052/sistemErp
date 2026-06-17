import { dashboardService } from './dashboard.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const dashboardController = {
  getSummary: asyncHandler(async (req, res) => {
    const { companyId } = req;
    const summary = await dashboardService.getSummary(companyId);
    return res.json(summary);
  }),
};
