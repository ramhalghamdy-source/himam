import { useMemo } from 'react';
import { useI18n } from '../i18n';
import type { TKey } from '../i18n/translations';
import { assessPatient } from '../lib/patientAssessment';
import type { FunctionalProfile } from '../lib/readiness';
import type { DigitalMetrics, HandMetrics, ReachMetrics } from '../types/assessment';

type Props = {
  profile: FunctionalProfile;
  reach: ReachMetrics;
  hand: HandMetrics;
  digital: DigitalMetrics;
  demoMode: boolean;
  compact?: boolean;
  onStartTraining?: () => void;
};

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PatientAssessment({ profile, reach, hand, digital, demoMode, compact = false, onStartTraining }: Props) {
  const { t } = useI18n();
  const result = useMemo(() => assessPatient(profile, reach, hand, digital), [profile, reach, hand, digital]);
  const dash = (result.index / 100) * CIRCUMFERENCE;

  const status = (
    <article className={`pa-status tier-${result.tier}`}>
      <div className="card-kicker">{t('pa.status.kicker')}</div>
      <div className="pa-status-body">
        <div className="pa-gauge" role="img" aria-label={`${t('pa.gauge.label')} ${result.index}/100`}>
          <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true">
            <circle className="pa-gauge-track" cx="64" cy="64" r={RADIUS} />
            <circle
              className="pa-gauge-fill"
              cx="64"
              cy="64"
              r={RADIUS}
              strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
              transform="rotate(-90 64 64)"
            />
          </svg>
          <div className="pa-gauge-center">
            <strong>{result.index}</strong>
            <span>{t('pa.gauge.label')}</span>
          </div>
        </div>
        <div className="pa-status-copy">
          <h3>{t(`pa.tier.${result.tier}.label` as TKey)}</h3>
          <p>{t(`pa.tier.${result.tier}.summary` as TKey)}</p>
        </div>
      </div>

      <div className="pa-plan">
        <div>
          <span>{t('pa.plan.weekly')}</span>
          <strong>{t('pa.plan.days', { n: result.weeklyGoal })}</strong>
        </div>
        <div>
          <span>{t('pa.plan.reassess')}</span>
          <strong>{t('pa.plan.weeks', { n: result.reassessWeeks })}</strong>
        </div>
        <div>
          <span>{t('pa.plan.confidence')}</span>
          <strong>{demoMode ? t('pa.confidence.demo') : t('pa.confidence.live')}</strong>
        </div>
      </div>

      {result.therapistReview && (
        <div className="pa-callout" role="note">
          <strong>{t('pa.review.title')}</strong>
          <p>{t('pa.review.text')}</p>
        </div>
      )}

      {!compact && onStartTraining && (
        <button className="primary-btn light-btn" onClick={onStartTraining}>{t('results.startTraining')}</button>
      )}
    </article>
  );

  const flags = (
    <article className="pa-card pa-flags">
      <div className="card-kicker">{t('pa.flags.kicker')}</div>
      {result.flags.length === 0 ? (
        <p className="pa-empty">{t('pa.flags.none')}</p>
      ) : (
        <ul>
          {result.flags.map((flag) => (
            <li key={flag.id} className={`sev-${flag.severity}`}>
              <i aria-hidden="true" />
              <div>
                <strong>{t(`pa.flag.${flag.id}.title` as TKey)}</strong>
                <p>{t(`pa.flag.${flag.id}.text` as TKey, { v: flag.value })}</p>
              </div>
              <span>{t(`pa.sev.${flag.severity}` as TKey)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );

  if (compact) {
    return (
      <section className="patient-assessment compact">
        <div className="pa-grid">
          {status}
          {flags}
        </div>
      </section>
    );
  }

  return (
    <section className="patient-assessment">
      <div className="pa-head">
        <div className="eyebrow">{t('pa.eyebrow')}</div>
        <h2>{t('pa.title')}</h2>
        <p className="section-copy">{t('pa.copy')}</p>
      </div>

      <div className="pa-grid">
        {status}

        <article className="pa-card pa-domains">
          <div className="card-kicker">{t('pa.domains.kicker')}</div>
          {result.domains.map((domain) => (
            <div className="pa-domain-row" key={domain.key}>
              <div className="pa-domain-top">
                <span>{t(`domainShort.${domain.key}` as TKey)}</span>
                <b className={`pa-pill tier-${domain.tier}`}>{t(`pa.tier.${domain.tier}.short` as TKey)}</b>
                <strong>{domain.score}</strong>
              </div>
              <div className="pa-bar"><i className={`tier-${domain.tier}`} style={{ width: `${domain.score}%` }} /></div>
            </div>
          ))}
        </article>

        <article className="pa-card pa-insights">
          <div className="card-kicker">{t('pa.insights.kicker')}</div>
          <div className="pa-insight strengths">
            <h4>{t('pa.strengths')}</h4>
            {result.strengths.length ? (
              <ul>{result.strengths.map((key) => <li key={key}>{t(`domain.${key}` as TKey)}</li>)}</ul>
            ) : (
              <p>{t('pa.strengths.none')}</p>
            )}
          </div>
          <div className="pa-insight focus">
            <h4>{t('pa.focus')}</h4>
            {result.focus.length ? (
              <ul>{result.focus.map((key) => <li key={key}>{t(`domain.${key}` as TKey)}</li>)}</ul>
            ) : (
              <p>{t('pa.focus.none')}</p>
            )}
          </div>
        </article>

        {flags}
      </div>

      <p className="pa-disclaimer">{t('pa.disclaimer')}</p>
    </section>
  );
}
