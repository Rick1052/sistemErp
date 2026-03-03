export const asyncHandler = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next); // O .catch(next) joga o erro direto para o Global Handler
  };
};