import Field from "../../components/Field";

const INPUT_TYPES = { date: "date", number: "number", integer: "number" };

// Renders the inputs for one record type from forms/fields.js.
export default function RecordFields({
  fields,
  values,
  errors = {},
  onChange,
  disabled = false,
}) {
  return fields.map((field) => {
    const label = `${field.label}${field.unit ? ` (${field.unit})` : ""}${
      field.required ? " *" : ""
    }`;
    const common = {
      id: field.name,
      name: field.name,
      value: values[field.name] ?? "",
      onChange: (event) => onChange(field.name, event.target.value),
      disabled,
      required: field.required,
    };
    return (
      <Field
        key={field.name}
        label={label}
        name={field.name}
        error={errors[field.name]}
      >
        {field.type === "textarea" ? (
          <textarea rows={3} {...common} />
        ) : (
          <input
            type={INPUT_TYPES[field.type] || "text"}
            step={
              field.type === "integer"
                ? "1"
                : field.type === "number"
                  ? "any"
                  : undefined
            }
            min={INPUT_TYPES[field.type] === "number" ? "0" : undefined}
            {...common}
          />
        )}
      </Field>
    );
  });
}
