import "./style.css";

export default function Table({
  columns,
  rows,
  emptyText = "Nothing to show yet.",
}) {
  return (
    <div className="table">
      <table className="table__grid">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="table__head">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="table__empty" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((col) => (
                  <td key={col.key} className="table__cell">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
