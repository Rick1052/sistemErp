import { dreComparativeService } from './dreComparative.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';

export const reportController = {
  getDRE: asyncHandler(async (req, res) => {
    const { startDate, endDate, year, month, groupId, subgroupId } = req.query;

    if (!startDate && !endDate && !year) {
      throw new AppError('Informe o ano ou o intervalo de datas (startDate/endDate).', 400);
    }

    const dreReport = await dreComparativeService.getComparativeDRE(req.companyId, {
      startDate,
      endDate,
      year,
      month,
      groupId: groupId || undefined,
      subgroupId: subgroupId || undefined,
    });
    res.json(dreReport);
  }),

  getDREDrillDown: asyncHandler(async (req, res) => {
    const result = await dreComparativeService.getDrillDown(req.companyId, req.query);
    res.json(result);
  }),
};
