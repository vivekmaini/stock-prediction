import { useEffect, useRef, useState } from 'react'
import axiosInstance from '../axiosInstance'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faArrowTrendUp, faArrowTrendDown, faMinus } from '@fortawesome/free-solid-svg-icons'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(
    CategoryScale, LinearScale, PointElement,
    LineElement, BarElement, Title, Tooltip, Legend, Filler
)

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d))

const COLORS = {
    blue:  '#378ADD',
    teal:  '#1D9E75',
    amber: '#EF9F27',
    red:   '#E24B4A',
    green: '#639922',
    muted: 'rgba(136,135,128,0.5)',
}

const baseChartOptions = (extraScales = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#1a1a1a',
            titleColor: '#ccc',
            bodyColor: '#eee',
            borderColor: '#333',
            borderWidth: 1,
            padding: 10,
        },
    },
    scales: {
        x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#888', font: { size: 10 }, maxTicksLimit: 8 },
        },
        y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#888', font: { size: 10 }, maxTicksLimit: 5 },
        },
        ...extraScales,
    },
    elements: {
        point: { radius: 0, hoverRadius: 4 },
        line:  { tension: 0.4, borderWidth: 2 },
    },
})

/* ─── sub-components ───────────────────────────────────────── */

function MetricCard({ label, value, suffix = '', colorClass = '' }) {
    return (
        <div style={styles.metricCard}>
            <p style={styles.metricLabel}>{label}</p>
            <p style={{ ...styles.metricValue, ...colorClass }}>{value}{suffix}</p>
        </div>
    )
}

function ChartCard({ title, sub, height = 280, children, fullWidth = false }) {
    return (
        <div style={{ ...styles.chartCard, ...(fullWidth ? styles.chartFull : {}) }}>
            <div style={styles.chartHeader}>
                <span style={styles.chartName}>{title}</span>
                {sub && <span style={styles.chartSub}>{sub}</span>}
            </div>

            <div style={{
                padding: '10px 16px 16px',
                height: height,
                minHeight: height
            }}>
                {children}
            </div>
        </div>
    )
}
function SignalBadge({ signal }) {
    if (!signal) return null
    const map = {
        BUY:  { bg: '#EAF3DE', color: '#3B6D11', icon: faArrowTrendUp,   label: 'BUY'  },
        SELL: { bg: '#FCEBEB', color: '#A32D2D', icon: faArrowTrendDown, label: 'SELL' },
        HOLD: { bg: '#FAEEDA', color: '#854F0B', icon: faMinus,          label: 'HOLD' },
    }
    const s = map[signal] || map.HOLD
    return (
        <span style={{ ...styles.signalBadge, background: s.bg, color: s.color }}>
            <FontAwesomeIcon icon={s.icon} style={{ marginRight: 6 }} />
            {s.label}
        </span>
    )
}

function EvalBar({ value, max = 1, color = COLORS.blue }) {
    const pct = Math.min(100, (value / max) * 100)
    return (
        <div style={styles.evalBar}>
            <div style={{ ...styles.evalFill, width: `${pct}%`, background: color }} />
        </div>
    )
}

/* ─── main component ───────────────────────────────────────── */

const Dashboard = () => {
    const [ticker, setTicker]               = useState('')
    const [error, setError]                 = useState(null)
    const [loading, setLoading]             = useState(false)

    // price stats
    const [currentPrice, setCurrentPrice]   = useState(null)
    const [oldPrice, setOldPrice]           = useState(null)
    const [priceChange, setPriceChange]     = useState(null)
    const [percentageChange, setPercentage] = useState(null)
    const [signal, setSignal]               = useState(null)

    // model metrics
    const [mse, setMSE]   = useState(null)
    const [rmse, setRMSE] = useState(null)
    const [r2, setR2]     = useState(null)

    // chart data arrays from backend
    const [historyDates,  setHistoryDates]  = useState([])
    const [closePrices,   setClosePrices]   = useState([])
    const [ma100Data,     setMA100Data]     = useState([])
    const [ma200Data,     setMA200Data]     = useState([])
    const [predDates,     setPredDates]     = useState([])
    const [actualPrices,  setActualPrices]  = useState([])
    const [predPrices,    setPredPrices]    = useState([])
    const [signalDates,   setSignalDates]   = useState([])
    const [signalValues,  setSignalValues]  = useState([])

    const hasResults = currentPrice !== null

    useEffect(() => {
        const fetchProtectedData = async () => {
            try { await axiosInstance.get('/protected-view/') }
            catch (e) { console.error('Error fetching data:', e) }
        }
        fetchProtectedData()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data } = await axiosInstance.post('/predict/', { ticker })

            // ── price stats ──────────────────────────────────
            setCurrentPrice(data.current_price)
            setOldPrice(data.old_price)
            setPriceChange(data.price_change)
            setPercentage(data.percentage_change)
            setSignal(data.signal)

            // ── model metrics ────────────────────────────────
            setMSE(data.mse)
            setRMSE(data.rmse)
            setR2(data.r2)

            /*
             * ── chart data ───────────────────────────────────
             * Backend should now return JSON arrays instead of image URLs.
             * Expected fields (all arrays):
             *   data.history_dates    — e.g. ["2024-01-02", ...]
             *   data.close_prices     — e.g. [182.5, ...]
             *   data.ma100            — e.g. [null, null, ..., 179.3, ...]
             *   data.ma200            — e.g. [null, ..., 165.2, ...]
             *   data.pred_dates       — dates for prediction section
             *   data.actual_prices    — actual close for prediction window
             *   data.pred_prices      — LSTM predicted prices
             *   data.signal_dates     — dates for signal chart
             *   data.signal_values    — 1 (BUY) or -1 (SELL) per date
             *
             * If your backend still returns image URLs, replace the
             * sections below with <img> tags (see commented block).
             */
            setHistoryDates(data.history_dates  || [])
            setClosePrices(data.close_prices     || [])
            setMA100Data(data.ma100              || [])
            setMA200Data(data.ma200              || [])
            setPredDates(data.pred_dates         || [])
            setActualPrices(data.actual_prices   || [])
            setPredPrices(data.pred_prices       || [])
            setSignalDates(data.signal_dates     || [])
            setSignalValues(data.signal_values   || [])

            if (data.error) setError(data.error)

        } catch (err) {
            console.error('API Error:', err)
            setError('Something went wrong. Check backend.')
        } finally {
            setLoading(false)
        }
    }

    /* ── derived chart configs ─────────────────────────────── */

    const safePrices = closePrices
    .map(v => Number(v))
    .filter(v => !isNaN(v))

const safeDates = historyDates.slice(0, safePrices.length)

const priceHistoryData = {
    labels: safeDates,
    datasets: [{
        label: 'Close',
        data: safePrices,
        borderColor: '#378ADD',
        backgroundColor: 'rgba(55,138,221,0.1)',
        fill: true,
        tension: 0.4
    }]
}

    const ma100ChartData = {
        labels: historyDates,
        datasets: [
            { label: 'Close', data: closePrices, borderColor: COLORS.muted, borderWidth: 1.5 },
            { label: 'MA 100', data: ma100Data,  borderColor: COLORS.teal,  borderWidth: 2   },
        ],
    }
    const ma100Opts = {
        ...baseChartOptions(),
        plugins: {
            ...baseChartOptions().plugins,
            legend: {
                display: true,
                labels: { color: '#999', font: { size: 10 }, boxWidth: 10, padding: 8 },
            },
        },
    }

    const ma200ChartData = {
        labels: historyDates,
        datasets: [
            { label: 'Close', data: closePrices, borderColor: COLORS.muted, borderWidth: 1.5 },
            { label: 'MA 200', data: ma200Data,  borderColor: COLORS.amber, borderWidth: 2   },
        ],
    }

    const predChartData = {
        labels: predDates,
        datasets: [
            { label: 'Actual',    data: actualPrices, borderColor: COLORS.blue, borderWidth: 2 },
            { label: 'Predicted', data: predPrices,   borderColor: COLORS.red,  borderWidth: 2, borderDash: [5, 4] },
        ],
    }
    const predOpts = {
        ...baseChartOptions(),
        plugins: {
            ...baseChartOptions().plugins,
            legend: {
                display: true,
                labels: { color: '#999', font: { size: 11 }, boxWidth: 12, padding: 12 },
            },
        },
    }

    const signalChartData = {
        labels: signalDates,
        datasets: [{
            label: 'Signal',
            data: signalValues,
            backgroundColor: signalValues.map(v =>
                v === 1 ? 'rgba(99,153,34,0.75)' : 'rgba(226,75,74,0.75)'
            ),
            borderRadius: 3,
            borderWidth: 0,
        }],
    }
    const signalOpts = {
        ...baseChartOptions(),
        scales: {
            ...baseChartOptions().scales,
            y: {
                ...baseChartOptions().scales.y,
                ticks: {
                    color: '#888', font: { size: 10 },
                    callback: v => v === 1 ? 'BUY' : v === -1 ? 'SELL' : '',
                },
            },
        },
    }

    /* ── render ────────────────────────────────────────────── */
    const up   = v => v > 0
    const down = v => v < 0

    return (
        <div style={styles.root}>

            {/* ── SEARCH ──────────────────────────────────── */}
            <div style={styles.searchWrap}>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <input
                        type="text"
                        style={styles.input}
                        placeholder="Enter stock ticker (e.g. AAPL)"
                        value={ticker}
                        onChange={e => setTicker(e.target.value.toUpperCase())}
                        required
                    />
                    <button type="submit" style={styles.btn} disabled={loading}>
                        {loading
                            ? <><FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />Analysing…</>
                            : 'See Prediction'}
                    </button>
                     {error && <p style={styles.errorMsg}>{error}</p>}
                </form>
                
            </div>

            {/* ── RESULTS ─────────────────────────────────── */}
            {hasResults && (
                <div style={styles.results}>
               
                    {/* Signal bar */}
                    <div style={styles.signalBar}>
                        <span style={styles.signalLabel}>Signal</span>
                        <SignalBadge signal={signal} />
                    </div>

                    {/* Price metrics */}
                    <div style={styles.metricGrid}>
                        <MetricCard label="Current price" value={`$${fmt(currentPrice)}`} />
                        <MetricCard label="Price 100 days ago" value={`$${fmt(oldPrice)}`} />
                        <MetricCard
                            label="Change"
                            value={`${up(priceChange) ? '+' : ''}$${fmt(priceChange)}`}
                            colorClass={up(priceChange) ? { color: '#639922' } : down(priceChange) ? { color: '#E24B4A' } : {}}
                        />
                        <MetricCard
                            label="% change"
                            value={`${up(percentageChange) ? '+' : ''}${fmt(percentageChange)}%`}
                            colorClass={up(percentageChange) ? { color: '#639922' } : down(percentageChange) ? { color: '#E24B4A' } : {}}
                        />
                    </div>

                    {/* Charts */}
                    <p style={styles.sectionTitle}>Charts &amp; moving averages</p>
                    <div style={styles.chartGrid}>

                        <ChartCard title="Price history" sub="Full period" height={180} fullWidth>
                            <Line data={priceHistoryData} options={baseChartOptions()} />
                        </ChartCard>

                        <ChartCard title="100-day MA" sub="vs close price" height={150}>
                            <Line data={ma100ChartData} options={ma100Opts} />
                        </ChartCard>

                        <ChartCard title="200-day MA" sub="vs close price" height={150}>
                            <Line data={ma200ChartData} options={ma100Opts} />
                        </ChartCard>

                        <ChartCard title="Predicted vs actual" sub="LSTM model output" height={180} fullWidth>
                            <Line data={predChartData} options={predOpts} />
                        </ChartCard>

                        <ChartCard title="Buy / sell signals" sub="MA crossover strategy" height={130} fullWidth>
                            <Bar data={signalChartData} options={signalOpts} />
                        </ChartCard>

                    </div>

                    {/* Model evaluation */}
                    <div style={styles.evalCard}>
                        <p style={styles.sectionTitle}>Model evaluation</p>
                        <div style={styles.evalGrid}>
                            <div style={styles.evalItem}>
                                <p style={styles.evalNum}>{fmt(mse, 5)}</p>
                                <p style={styles.evalLbl}>MSE</p>
                                <EvalBar value={mse} max={0.01} color={COLORS.amber} />
                            </div>
                            <div style={styles.evalItem}>
                                <p style={styles.evalNum}>{fmt(rmse, 4)}</p>
                                <p style={styles.evalLbl}>RMSE</p>
                                <EvalBar value={rmse} max={0.1} color={COLORS.blue} />
                            </div>
                            <div style={styles.evalItem}>
                                <p style={styles.evalNum}>{fmt(r2, 3)}</p>
                                <p style={styles.evalLbl}>R² score</p>
                                <EvalBar value={r2} max={1} color={COLORS.green} />
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>
    )
}

/* ─── styles ───────────────────────────────────────────────── */
const styles = {
   root: {
    width: '100%',
    maxWidth: 1400,
    margin: '0 auto',
    padding: '2rem',
    minHeight: '100vh',              // 🔥 full screen height
    display: 'flex',
    flexDirection: 'column',
     paddingTop: '1rem',
     
},

 searchWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '100px', 
    marginBottom:'30px'  // ✅ safe spacing
},

  form: {
    display: 'flex',
    gap: 12,
    width: '100%',
    maxWidth: '600px', 
    flexWrap: 'wrap',               // 🔥 controlled width
},

   input: {
    flex: 1,
    padding: '14px 18px',
    fontSize: 15,
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 10,
    color: '#e8e8e8',
    outline: 'none',
},

   btn: {
    padding: '14px 20px',
    fontSize: 14,
    fontWeight: 500,
   background: '#01d9ff',
    color: 'black',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'Inter, system-ui, sans-serif',
    
},

   errorMsg: {

    width: '100%',        // 🔥 NEW LINE FORCE

    marginTop: 6,

    color: '#E24B4A',

    fontSize: 13,

    textAlign: 'left',    // center bhi kar sakta hai

},

   results: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.2rem'   // 🔥 tighter spacing
},

    signalBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: '10px 18px',
    
    maxWidth: '500px',   // 🔥 width control
    width: '100%',
    margin: '0 auto',    // 🔥 center
    
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
},

    signalLabel: {
        fontSize: 13,
        color: '#888'
    },

    signalBadge: {
        fontSize: 13,
        fontWeight: 600,
        padding: '6px 18px',
        borderRadius: 999,
    },


    metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',   // 🔥 fixed layout (not auto-fit)
    gap: 16,
    transform: 'translateX(100px)',
     
},

    metricLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 6
    },

    metricValue: {
        fontSize: 24,
        fontWeight: 600,
        color: '#e8e8e8'
    },

    sectionTitle: {
        fontSize: 11,
        fontWeight: 500,
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
    },

   chartGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',   // 🔥 stable layout
    gap: '20px',
},

    chartCard: {
        background: '#131313',
        border: '1px solid #222',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 8px 25px rgba(0,0,0,0.45)',
        minHeight: 260, // 🔥 height base fix
        paddingBottom: '10px',
    },

    chartFull: {
        gridColumn: '1 / -1'
    },

    chartHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 18px 0',
    },

    chartName: {
        fontSize: 14,
        fontWeight: 600,
        color: '#d0d0d0'
    },

    chartSub: {
        fontSize: 11,
        color: '#555'
    },

    evalCard: {
        background: '#131313',
        border: '1px solid #222',
        borderRadius: 14,
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
        margin:'10px',
    },

    evalGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '1.2rem'
    },

    evalItem: {
        textAlign: 'center'
    },

    evalNum: {
        fontSize: 24,
        fontWeight: 600,
        color: '#e8e8e8'
    },

    evalLbl: {
        fontSize: 12,
        color: '#666',
        marginTop: 4
    },

    evalBar: {
        height: 5,
        borderRadius: 3,
        background: '#2a2a2a',
        marginTop: 12,
        overflow: 'hidden',
    },

    evalFill: {
        height: '100%',
        borderRadius: 3
    },
}
export default Dashboard
