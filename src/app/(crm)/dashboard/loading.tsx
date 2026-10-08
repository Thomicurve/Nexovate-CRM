import styles from "@/components/dashboard/dashboard.module.css";
export default function DashboardLoading() {
  return <div className={styles.dashboard} aria-busy="true"><h1>Dashboard</h1><p role="status">Cargando métricas…</p>
    {Array.from({ length: 3 }, (_, i) => <div key={i} className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>)}
  </div>;
}
