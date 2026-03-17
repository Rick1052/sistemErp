import { ZodError } from "zod";
import logger from "../utils/logger.js";

export function validate(schema) {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.body);

      req.validatedBody = validatedData;

      next();
    } catch (error) {

      if (error instanceof ZodError) {
        // Redacting sensitive info from logs
        const redactedBody = { ...req.body };
        if (redactedBody.password) redactedBody.password = '[RECORDS]';
        if (redactedBody.email && req.path.includes('login')) redactedBody.email = '[RECORDS]';

        logger.warn({
          msg: "Validation error on request",
          path: req.path,
          method: req.method,
          errors: error.flatten().fieldErrors,
          payload: redactedBody
        });

        return res.status(400).json({
          message: "Erro de validação nos dados enviados",
          errors: error.flatten().fieldErrors
        });
      }

      next(error);
    }
  };
}