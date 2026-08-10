import React, { useState } from 'react';
import {
  PiggyBank,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Layers,
} from 'lucide-react';
import { SavingsYearlySummary, SavingsDistributionItem } from '../../lib/types';

interface SavingsVisualizerProps {
  summary: SavingsYearlySummary;
  currencySymbol: string;
}

export const SavingsVisualizer: React.FC<SavingsVisualizerProps> = ({
  summary,
  currencySymbol,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // SVG Pie/Donut calculations
  const size = 220;
  const strokeWidth = 36;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = 0;

  return (
    <div style={styles.container} className="animate-fade-in">
      <div style={styles.cardHeader}>
        <div style={styles.headerTitleWrap}>
          <div style={styles.iconCircle}>
            <PiggyBank size={18} color="var(--primary)" />
          </div>
          <div>
            <h3 style={styles.cardTitle}>Savings & Investment Status</h3>
            <span style={styles.cardSubtitle}>Year {summary.year} Asset Distribution</span>
          </div>
        </div>
      </div>

      {/* Baseline vs Current Status Comparison Banner */}
      <div style={styles.baselineCard}>
        <div style={styles.baselineGrid}>
          <div style={styles.baselineCol}>
            <span style={styles.baselineLabel}>Start-of-Year Baseline</span>
            <span style={styles.baselineValue}>
              {currencySymbol} {summary.startOfYearBaseline.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div style={styles.baselineGrowthCol}>
            <div style={styles.growthBadge}>
              <ArrowUpRight size={14} color="var(--success-text)" />
              <span>+{summary.netGrowthPercentage.toFixed(1)}% Growth</span>
            </div>
            <span style={styles.growthAmount}>
              +{currencySymbol} {summary.netGrowth.toLocaleString('en-US', { maximumFractionDigits: 0 })} YTD
            </span>
          </div>

          <div style={styles.baselineCol}>
            <span style={styles.baselineLabel}>Current Portfolio Total</span>
            <span style={{ ...styles.baselineValue, color: 'var(--primary)' }}>
              {currencySymbol} {summary.currentTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Growth Visual Bar */}
        <div style={styles.growthBarTrack}>
          <div
            style={{
              ...styles.growthBarBaseline,
              width: `${Math.min(85, Math.round((summary.startOfYearBaseline / summary.currentTotal) * 100))}%`,
            }}
          />
          <div style={styles.growthBarGain} />
        </div>
        <div style={styles.growthBarLabels}>
          <span>Jan 1 Baseline</span>
          <span style={{ color: 'var(--success-text)', fontWeight: '700' }}>
            +{currencySymbol} {summary.netGrowth.toLocaleString('en-US', { maximumFractionDigits: 0 })} Net Gain
          </span>
          <span>Current</span>
        </div>
      </div>

      {/* Donut Chart and Interactive Details */}
      <div style={styles.chartSection}>
        {/* SVG Donut Chart */}
        <div style={styles.donutContainer}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={styles.svgChart}>
            {summary.items.map((item, index) => {
              const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -cumulativeAngle;
              cumulativeAngle += (item.percentage / 100) * circumference;

              const isHovered = hoveredIndex === index;

              return (
                <circle
                  key={item.type}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  style={{
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    transformOrigin: 'center',
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Central Donut Text */}
          <div style={styles.donutCenterText}>
            <span style={styles.centerLabel}>
              {hoveredIndex !== null ? summary.items[hoveredIndex].label.split(' ')[0] : 'Total Assets'}
            </span>
            <span style={styles.centerValue}>
              {currencySymbol}{' '}
              {hoveredIndex !== null
                ? summary.items[hoveredIndex].amount.toLocaleString('en-US', { maximumFractionDigits: 0 })
                : summary.currentTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            {hoveredIndex !== null && (
              <span style={styles.centerSub}>
                {summary.items[hoveredIndex].percentage.toFixed(1)}% of total
              </span>
            )}
          </div>
        </div>

        {/* Legend List */}
        <div style={styles.legendContainer}>
          {summary.items.map((item, index) => {
            const isHovered = hoveredIndex === index;

            return (
              <div
                key={item.type}
                style={{
                  ...styles.legendItem,
                  ...(isHovered ? styles.legendItemHovered : {}),
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div style={styles.legendLeft}>
                  <div style={{ ...styles.legendDot, backgroundColor: item.color }} />
                  <div>
                    <div style={styles.legendName}>{item.label}</div>
                    {item.monthlyDeposit ? (
                      <div style={styles.legendDeposit}>
                        +{currencySymbol}{item.monthlyDeposit.toLocaleString()}/mo deposit
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={styles.legendRight}>
                  <div style={styles.legendAmount}>
                    {currencySymbol} {item.amount.toLocaleString('en-US')}
                  </div>
                  <div style={styles.legendPct}>{item.percentage.toFixed(1)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-main)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  iconCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  cardSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  baselineCard: {
    backgroundColor: 'var(--bg-surface-subtle)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-main)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  baselineGrid: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
  },
  baselineCol: {
    display: 'flex',
    flexDirection: 'column',
  },
  baselineLabel: {
    fontSize: '0.6875rem',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    marginBottom: '2px',
  },
  baselineValue: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  baselineGrowthCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  growthBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    backgroundColor: 'var(--success-light)',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--success-text)',
  },
  growthAmount: {
    fontSize: '0.6875rem',
    color: 'var(--success-text)',
    fontWeight: '600',
    marginTop: '2px',
  },
  growthBarTrack: {
    height: '8px',
    backgroundColor: 'var(--border-main)',
    borderRadius: '4px',
    overflow: 'hidden',
    display: 'flex',
  },
  growthBarBaseline: {
    height: '100%',
    backgroundColor: 'var(--primary)',
  },
  growthBarGain: {
    flex: 1,
    height: '100%',
    backgroundColor: 'var(--success)',
  },
  growthBarLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
  },
  chartSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: '24px',
  },
  donutContainer: {
    position: 'relative',
    width: '220px',
    height: '220px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgChart: {
    transform: 'rotate(-90deg)',
  },
  donutCenterText: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  centerLabel: {
    fontSize: '0.6875rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  centerValue: {
    fontSize: '1.0625rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
  },
  centerSub: {
    fontSize: '0.6875rem',
    color: 'var(--primary)',
    fontWeight: '700',
  },
  legendContainer: {
    flex: 1,
    minWidth: '220px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-subtle)',
    border: '1px solid var(--border-main)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  legendItemHovered: {
    backgroundColor: 'var(--primary-light)',
    borderColor: 'var(--primary)',
  },
  legendLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  legendName: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  legendDeposit: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
  },
  legendRight: {
    textAlign: 'right',
  },
  legendAmount: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  legendPct: {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
  },
};
