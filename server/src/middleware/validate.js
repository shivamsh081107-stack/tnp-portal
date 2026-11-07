const { ApiError } = require('../utils/apiError');

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      return next(
        new ApiError(
          400,
          'Validation failed',
          error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))
        )
      );
    }
    req[source] = value;
    return next();
  };
}

module.exports = { validate };
