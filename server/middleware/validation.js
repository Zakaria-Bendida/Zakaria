// middleware/validation.js (ESM version)
import { body, param, query, validationResult } from "express-validator";

// Validation rules for coordinates
const validateCoordinates = [
  body("lat")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),
  body("lon")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),
];

// Validation rules for IDs
const validateId = (req, res, next) => {
  const id = req.params.interventionId || req.params.id;

  if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
    return res.status(400).json({
      success: false,
      errors: [{ message: "ID must be a positive integer" }],
    });
  }

  req.validatedId = parseInt(id);
  next();
};

// Validation rules for ambulance creation
const validateAmbulance = [
  body("immatriculation")
    .notEmpty()
    .withMessage("Immatriculation is required")
    .isLength({ max: 50 }),
  body("type").notEmpty().withMessage("Type is required"),
  body("kilometrage")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Kilometrage must be a positive integer"),
];

// Validation rules for intervention
const validateIntervention = [
  body("type").notEmpty().withMessage("Type is required"),
  body("latitude_depart")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude"),
  body("longitude_depart")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description too long"),
];

// Validation for SOS
const validateSOS = [
  body("lat").isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  body("lon").isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
  body("type").optional().isString().withMessage("Type must be a string"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description too long"),
];

// Validation rules for user registration
const validateUserAuth = [
  body("fullName")
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 100 }),
  body("phone")
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^(05|06|07)[0-9]{8}$/)
    .withMessage(
      "Invalid Algerian phone number. Must start with 05, 06, or 07 and have 10 digits total",
    ),
];

// Validation rules for driver login
const validateDriverLogin = [
  body("phone")
    .matches(/^(05|06|07)[0-9]{8}$/)
    .withMessage("Invalid Algerian phone number"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Validation rules for hospital
const validateHospital = [
  body("nom").notEmpty().withMessage("Hospital name is required"),
  body("latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Invalid latitude"),
  body("longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Invalid longitude"),
];

// Check validation results
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

export {
  validateCoordinates,
  validateId,
  validateAmbulance,
  validateIntervention,
  validateSOS,
  validateUserAuth,
  validateDriverLogin,
  validateHospital,
  checkValidation,
};
