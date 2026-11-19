import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'

type Filters = { q: string; year: string; province: string; crime: string; month: string }
type Count = { label: string; count: number }
type PoliceRecord = {
  id: number
  crime: string
  subcrime: string
  date: string
  victim: string
  province: string
  canton: string
  district: string
}
type Result = {
  year: number
  page: number
  pageSize: number
  total: number
  firstDate: string
  lastDate: string
  source: string
  filters: { years: number[]; provinces: string[]; crimes: string[] }
  summary: { monthly: { month: number; count: number }[]; crimes: Count[]; provinces: Count[] }
  records: PoliceRecord[]
}

const initial: Filters = { q: '', year: '2025', province: '', crime: '', month: '' }
const years = Array.from({ length: 12 }, (_, i) => 2026 - i)
const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const source = 'https://datosabiertospj.poder-judicial.go.cr/dataset/estadisticas-policiales'
const number = new Intl.NumberFormat('es-CR')
const formatDate = (date: string) => date.split('-').reverse().join('/')
const title = (text?: string) =>
  text
    ?.toLocaleLowerCase('es-CR')
    .replace(/(^|[\s/])\p{L}/gu, (char) => char.toLocaleUpperCase('es-CR')) || 'Sin especificar'

type IconName =
  'radar' | 'grid' | 'search' | 'chart' | 'list' | 'database' | 'pin' | 'layers' | 'calendar'
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    radar: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <path d="m12 12 7-7M12 12h.01" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    chart: <path d="M4 4v16h16M8 15v-3m5 3V8m5 7v-5" />,
    list: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8m-8 4h8m-8 4h5" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5.5" rx="8" ry="3" />
        <path d="M4 5.5v13c0 4 16 4 16 0v-13M4 12c0 4 16 4 16 0" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 10h18" />
      </>
    ),
  }
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label className="field">
      {label}
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
      </span>
    </label>
  )
}

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: string
  detail: string
  icon: IconName
}) {
  return (
    <article className="metric surface">
      <span className="metric-icon">
        <Icon name={icon} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function Ranking({ values, onSelect }: { values: Count[]; onSelect: (value: string) => void }) {
  const max = values[0]?.count || 1
  return (
    <div className="ranking">
      {values.slice(0, 5).map(({ label, count }) => (
        <button
          className="rank-row"
          type="button"
          key={label}
          onClick={() => onSelect(label)}
          aria-label={`Filtrar por ${title(label)}, ${number.format(count)} registros`}
        >
          <span>{title(label)}</span>
          <strong>{number.format(count)}</strong>
          <span className="rank-track">
            <span style={{ width: `${(count / max) * 100}%` }} />
          </span>
        </button>
      ))}
    </div>
  )
}

function App() {
  const [draft, setDraft] = useState(initial)
  const [request, setRequest] = useState({ filters: initial, page: 1 })
  const [response, setResponse] = useState<{
    request: typeof request
    data?: Result
    error?: string
  }>()
  const [section, setSection] = useState('resumen')
  const [group, setGroup] = useState<'crimes' | 'provinces'>('crimes')
  const [record, setRecord] = useState<PoliceRecord>()
  const dialog = useRef<HTMLDialogElement>(null)
  const ready = response?.request === request
  const data = response?.request.filters === request.filters ? response?.data : undefined
  const error = ready ? response.error : undefined
  const pending = !ready
  const catalog =
    response?.data?.year.toString() === draft.year ? response?.data?.filters : undefined

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(request.page) })
    for (const [key, value] of Object.entries(request.filters)) {
      if (value.trim()) params.set(key, value.trim())
    }

    async function search() {
      try {
        const res = await fetch(`/api/oij/registros?${params}`, { signal: controller.signal })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: unknown } | null
          throw new Error(
            typeof body?.message === 'string'
              ? body.message
              : 'El servicio del OIJ no está disponible. Intenta de nuevo.',
          )
        }
        const data = (await res.json()) as Result
        if (!controller.signal.aborted) setResponse({ request, data })
      } catch (cause) {
        if (!controller.signal.aborted)
          setResponse({
            request,
            error:
              cause instanceof Error && !(cause instanceof TypeError)
                ? cause.message
                : 'No se pudo conectar con el servidor. Intenta de nuevo.',
          })
      }
    }

    void search()
    return () => controller.abort()
  }, [request])

  function apply(filters: Filters) {
    setDraft(filters)
    setRequest({ filters, page: 1 })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    apply(draft)
  }

  function pageChange(page: number) {
    setRequest({ filters: request.filters, page })
  }

  const peak = Math.max(1, ...(data?.summary.monthly.map(({ count }) => count) ?? []))
  const scale = 10 ** Math.floor(Math.log10(peak))
  const ceiling = Math.ceil(peak / scale) * scale
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 1)))
  const knownProvinces = data?.summary.provinces.filter(({ label }) => label !== 'DESCONOCIDO')

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#resumen" onClick={() => setSection('resumen')}>
          <span className="brand-icon">
            <Icon name="radar" />
          </span>
          <span>
            <b>Radar CR</b>
            <small>Observatorio policial</small>
          </span>
        </a>
        <nav aria-label="Navegación del panel">
          <p>EXPLORACIÓN</p>
          {(
            [
              ['resumen', 'grid', 'Vista general'],
              ['analisis', 'chart', 'Análisis'],
              ['registros', 'list', 'Registros'],
            ] as const
          ).map(([id, icon, label]) => (
            <a
              key={id}
              className={section === id ? 'active' : ''}
              href={`#${id}`}
              onClick={() => setSection(id)}
            >
              <Icon name={icon} />
              {label}
            </a>
          ))}
        </nav>
        <a className="source" href={source} target="_blank" rel="noreferrer">
          <span className="source-icon">
            <Icon name="database" />
          </span>
          <span>
            <b>Datos abiertos OIJ</b>
            <small>Poder Judicial de Costa Rica</small>
          </span>
        </a>
      </aside>

      <main id="resumen">
        <header className="topbar">
          <span>
            Radar CR <span className="breadcrumb">/</span> Explorador
          </span>
          <a href={source} target="_blank" rel="noreferrer">
            <Icon name="database" /> Fuente oficial
          </a>
        </header>

        <div className="content">
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">
                <Icon name="radar" /> ESTADÍSTICAS POLICIALES
              </span>
              <h1>
                Explorador de <em>delitos</em>
              </h1>
              <p>
                Consulta los registros públicos del OIJ en Costa Rica y explora cómo se distribuyen
                por zona y periodo.
              </p>
            </div>
            <div className="radar-visual" aria-hidden="true">
              <span />
              <i />
              <b />
              <small />
            </div>
          </section>

          <section className="surface search-panel" aria-labelledby="search-title">
            <div className="section-head">
              <div>
                <h2 id="search-title">
                  <Icon name="search" /> Buscar registros
                </h2>
                <p>Busca por delito o localidad y acota los resultados.</p>
              </div>
              <button className="text-button" type="button" onClick={() => apply(initial)}>
                Limpiar filtros
              </button>
            </div>
            <form onSubmit={submit}>
              <label className="field keyword">
                Palabra clave
                <span className="input-wrap">
                  <Icon name="search" />
                  <input
                    value={draft.q}
                    maxLength={120}
                    placeholder="Ej. hurto, San José"
                    onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                  />
                </span>
              </label>
              <Select
                label="Provincia"
                value={draft.province}
                onChange={(province) => setDraft({ ...draft, province })}
              >
                <option value="">Todas</option>
                {catalog?.provinces.map((value) => (
                  <option key={value} value={value}>
                    {title(value)}
                  </option>
                ))}
              </Select>
              <Select
                label="Delito"
                value={draft.crime}
                onChange={(crime) => setDraft({ ...draft, crime })}
              >
                <option value="">Todos</option>
                {catalog?.crimes.map((value) => (
                  <option key={value} value={value}>
                    {title(value)}
                  </option>
                ))}
              </Select>
              <Select
                label="Año"
                value={draft.year}
                onChange={(year) => apply({ ...draft, year, province: '', crime: '', month: '' })}
              >
                {(catalog?.years ?? years).map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </Select>
              <button className="primary" type="submit">
                <Icon name="search" /> Buscar
              </button>
            </form>
            {request.filters.month && (
              <button
                className="month-filter"
                type="button"
                onClick={() => apply({ ...request.filters, month: '' })}
              >
                {months[Number(request.filters.month) - 1]}{' '}
                <span aria-label="Quitar filtro de mes">×</span>
              </button>
            )}
          </section>

          <section id="analisis" aria-labelledby="analysis-title">
            <div className="section-head analysis-head">
              <div>
                <h2 id="analysis-title">Resumen de la consulta</h2>
                <p role="status">
                  {data
                    ? `Cobertura de la fuente: ${formatDate(data.firstDate)} – ${formatDate(data.lastDate)}`
                    : pending
                      ? 'Cargando datos del OIJ…'
                      : 'Datos del OIJ sin conexión'}
                </p>
              </div>
              <span className="period">
                <Icon name="calendar" />
                {request.filters.year}
              </span>
            </div>
            {error && (
              <div className="surface notice" role="alert">
                <p>{error}</p>
                <button
                  className="primary"
                  type="button"
                  onClick={() => setRequest({ ...request })}
                >
                  Reintentar
                </button>
              </div>
            )}
            <div className="metrics" aria-busy={pending}>
              <Metric
                label="Registros encontrados"
                value={data ? number.format(data.total) : '—'}
                detail="Según los filtros aplicados"
                icon="list"
              />
              <Metric
                label="Tipos de delito"
                value={data ? number.format(data.summary.crimes.length) : '—'}
                detail={
                  data?.summary.crimes[0]
                    ? `Más frecuente: ${title(data.summary.crimes[0].label)}`
                    : 'Categorías de la consulta'
                }
                icon="layers"
              />
              <Metric
                label="Provincias identificadas"
                value={knownProvinces ? number.format(knownProvinces.length) : '—'}
                detail={
                  knownProvinces?.[0]
                    ? `Mayor volumen: ${title(knownProvinces[0].label)}`
                    : 'Provincias con registros'
                }
                icon="pin"
              />
            </div>

            <div className="charts" aria-busy={pending}>
              <article className="surface chart-card">
                <h3>
                  <Icon name="chart" /> Registros por mes
                </h3>
                <p>Selecciona un mes para ver sus registros.</p>
                {data?.summary.monthly.some(({ count }) => count > 0) ? (
                  <div className="chart-layout">
                    <div className="axis" aria-hidden="true">
                      {[ceiling, ceiling / 2, 0].map((value, index) => (
                        <span key={index}>{number.format(Math.round(value))}</span>
                      ))}
                    </div>
                    <div className="plot">
                      {data.summary.monthly.map(({ month, count }) => (
                        <button
                          type="button"
                          className="bar-column"
                          key={month}
                          title={`${months[month - 1]} · ${number.format(count)}`}
                          aria-label={`${months[month - 1]}, ${number.format(count)} registros`}
                          aria-pressed={request.filters.month === String(month)}
                          onClick={() =>
                            apply({
                              ...request.filters,
                              month: request.filters.month === String(month) ? '' : String(month),
                            })
                          }
                        >
                          <span className="bar-space">
                            <span style={{ height: `${(count / ceiling) * 100}%` }} />
                          </span>
                          <span className="month">{months[month - 1]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="empty">
                    {pending ? 'Cargando gráfica…' : 'Sin datos para graficar.'}
                  </p>
                )}
              </article>
              <article className="surface chart-card">
                <h3>
                  <Icon name="layers" /> Distribución de registros
                </h3>
                <div className="switch" aria-label="Agrupar gráfica">
                  <button
                    type="button"
                    aria-pressed={group === 'crimes'}
                    onClick={() => setGroup('crimes')}
                  >
                    Por delito
                  </button>
                  <button
                    type="button"
                    aria-pressed={group === 'provinces'}
                    onClick={() => setGroup('provinces')}
                  >
                    Por provincia
                  </button>
                </div>
                {data?.summary[group].length ? (
                  <Ranking
                    values={data.summary[group]}
                    onSelect={(value) =>
                      apply({
                        ...request.filters,
                        [group === 'crimes' ? 'crime' : 'province']: value,
                      })
                    }
                  />
                ) : (
                  <p className="empty">
                    {pending ? 'Cargando gráfica…' : 'Sin datos para graficar.'}
                  </p>
                )}
              </article>
            </div>
          </section>

          <section
            id="registros"
            className="surface records"
            aria-labelledby="records-title"
            aria-busy={pending}
          >
            <div className="section-head">
              <div>
                <h2 id="records-title">
                  <Icon name="list" /> Registros
                </h2>
                <p>
                  {data?.total
                    ? `${number.format((data.page - 1) * data.pageSize + 1)}–${number.format((data.page - 1) * data.pageSize + data.records.length)} de ${number.format(data.total)} · Más recientes primero`
                    : 'Resultados de la consulta'}
                </p>
              </div>
            </div>
            {data?.records.length ? (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Delito</th>
                        <th scope="col">Provincia</th>
                        <th scope="col">Cantón</th>
                        <th scope="col">Distrito</th>
                        <th scope="col">
                          <span className="visually-hidden">Detalle</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.records.map((row) => (
                        <tr key={row.id}>
                          <td className="date">{formatDate(row.date)}</td>
                          <td>
                            <span className="crime-tag">{title(row.crime)}</span>
                          </td>
                          <td>{title(row.province)}</td>
                          <td>{title(row.canton)}</td>
                          <td>{title(row.district)}</td>
                          <td>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => {
                                setRecord(row)
                                dialog.current?.showModal()
                              }}
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <button
                    type="button"
                    disabled={pending || data.page <= 1}
                    onClick={() => pageChange(data.page - 1)}
                  >
                    Anterior
                  </button>
                  <span aria-live="polite">
                    Página {number.format(data.page)} de {number.format(pages)}
                  </span>
                  <button
                    type="button"
                    disabled={pending || data.page >= pages}
                    onClick={() => pageChange(data.page + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            ) : (
              <p className="empty">
                {pending
                  ? 'Cargando registros…'
                  : error
                    ? 'Los registros aparecerán cuando se restablezca la conexión.'
                    : 'No se encontraron registros con estos filtros.'}
              </p>
            )}
          </section>

          <footer>
            Radar CR · Estadísticas policiales de Costa Rica{' '}
            <a href={data?.source ?? source} target="_blank" rel="noreferrer">
              Datos abiertos del Poder Judicial
            </a>
          </footer>
        </div>
      </main>
      <dialog ref={dialog} className="detail-dialog" aria-labelledby="detail-title">
        <div className="section-head">
          <div>
            <p>Detalle del registro</p>
            <h2 id="detail-title">{title(record?.crime)}</h2>
          </div>
          <form method="dialog">
            <button className="close" aria-label="Cerrar detalle">
              ×
            </button>
          </form>
        </div>
        {record && (
          <dl>
            {[
              ['Fecha', formatDate(record.date)],
              ['Subdelito', title(record.subcrime)],
              ['Tipo de víctima', title(record.victim)],
              ['Provincia', title(record.province)],
              ['Cantón', title(record.canton)],
              ['Distrito', title(record.district)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </dialog>
    </div>
  )
}

export default App
