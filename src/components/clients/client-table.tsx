import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { listPath, type ClientSort, type Filters } from "@/lib/clients/filters";
import type { Client } from "@/lib/clients/model";
import { displayClientDate } from "./client-details";
import styles from "./clients.module.css";

export function ClientTable({ rows, filters, disabled, onRead }: {
  rows: Client[]; filters: Filters; disabled: boolean; onRead: (client: Client, opener: HTMLButtonElement) => void;
}) {
  const sortable = (sort: ClientSort, label: string, optional = false) => {
    const selected = filters.sort === sort;
    const direction = selected && filters.direction === "asc" ? "desc" : "asc";
    return <th scope="col" aria-label={label} className={optional ? styles.optionalColumn : undefined}
      aria-sort={selected ? filters.direction === "asc" ? "ascending" : "descending" : "none"}>
      <Link className={styles.sortLink} href={listPath({ ...filters, sort, direction, page: 1 })}
        aria-label={`Ordenar por ${label.toLowerCase()}, ${direction === "asc" ? "ascendente" : "descendente"}`}
        aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => { if (disabled) event.preventDefault(); }}>
        {label}<span aria-hidden="true">{selected ? filters.direction === "asc" ? " ↑" : " ↓" : " ↕"}</span>
      </Link>
    </th>;
  };
  return <div className={styles.tableSurface}><table className={styles.table} aria-label="Clientes"><thead><tr>
    {sortable("nombre", "Nombre")}<th scope="col">Empresa</th><th scope="col">Estado</th>
    {sortable("contacto", "Contacto", true)}{sortable("reunion", "Reunión", true)}<th scope="col">Acciones</th>
  </tr></thead><tbody>{rows.map((row) => <tr key={row.id}>
    <td><span className={styles.clientName}>{row.name}</span></td><td><span className={styles.company}>{row.company || "Sin empresa"}</span></td>
    <td><span className={styles.status}>{row.status}</span></td>
    <td className={styles.optionalColumn}>{displayClientDate(row.contact_at)}</td>
    <td className={styles.optionalColumn}>{row.meeting_at ? displayClientDate(row.meeting_at) : "Sin cita"}</td>
    <td><button type="button" className={styles.readButton} aria-label={`Ver ${row.name}`} disabled={disabled}
      onClick={(event) => onRead(row, event.currentTarget)}>Ver</button></td>
  </tr>)}</tbody></table></div>;
}
