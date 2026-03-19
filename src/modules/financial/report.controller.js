import { reportService } from './report.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';

export const reportController = {
  getDRE: asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new AppError('As datas de início e fim são obrigatórias (query params: startDate, endDate)', 400);
    }

    const dreReport = await reportService.getDRE(req.companyId, startDate, endDate);
    res.json(dreReport);
  }),
};
