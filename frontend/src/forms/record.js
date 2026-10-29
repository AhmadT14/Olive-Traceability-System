function isNumeric(type) {
  return type === "number" || type === "integer";
}

function clean(value) {
  return typeof value === "string" ? value.trim() : value;
}

// Builds the record sent to both prepare and save. Empty values are dropped
// and number fields are sent as numbers.
export function buildRecord(fields, values) {
  const record = {};
  for (const field of fields) {
    const value = clean(values[field.name]);
    if (value === "" || value === undefined || value === null) continue;
    record[field.name] = isNumeric(field.type) ? Number(value) : value;
  }
  return record;
}

// Returns { fieldName: message } for values the form should not send.
export function validateRecord(fields, values) {
  const errors = {};
  for (const field of fields) {
    const value = clean(values[field.name]);
    const empty = value === "" || value === undefined || value === null;
    if (empty) {
      if (field.required) errors[field.name] = "This field is required.";
      continue;
    }
    if (isNumeric(field.type)) {
      const n = Number(value);
      if (Number.isNaN(n)) errors[field.name] = "Enter a number.";
      else if (n < 0) errors[field.name] = "Enter zero or more.";
      else if (field.type === "integer" && !Number.isInteger(n)) {
        errors[field.name] = "Enter a whole number.";
      }
    }
  }
  return errors;
}
