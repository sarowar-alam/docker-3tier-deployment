import React, { useState, useEffect } from 'react';
import { IconAlertCircle, IconCheckCircle, IconPlus } from './Icons';
import api from '../api';

const getTodayDate = () => new Date().toISOString().split('T')[0];

const ACTIVITY_OPTIONS = [
  { value: 'sedentary',   label: 'Sedentary',   description: 'Little or no exercise' },
  { value: 'light',       label: 'Light',        description: '1–3 days / week' },
  { value: 'moderate',    label: 'Moderate',     description: '3–5 days / week' },
  { value: 'active',      label: 'Active',       description: '6–7 days / week' },
  { value: 'very_active', label: 'Very Active',  description: 'Twice daily or intense' },
];

// Field-level validation rules
const RULES = {
  weightKg: { min: 1,  max: 500, hint: '1–500' },
  heightCm: { min: 50, max: 300, hint: '50–300' },
  age:      { min: 1,  max: 150, hint: '1–150' },
};

const validateField = (field, value) => {
  if (value === '' || value === null || value === undefined) return 'Required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Enter a number';
  const rule = RULES[field];
  if (rule && (num < rule.min || num > rule.max)) return `${rule.hint} range`;
  return null;
};

function FormGroup({ id, label, hint, error, children }) {
  return (
    <div className={`form-group${error ? ' form-group--error' : ''}`}>
      <label className="form-label" htmlFor={id}>
        {label}
        {hint && <span className="form-hint">{hint}</span>}
      </label>
      {children}
      {error && <span className="form-field-error" role="alert">{error}</span>}
    </div>
  );
}

export default function MeasurementForm({ onSaved, lastMeasurement }) {
  const [form, setForm] = useState({
    weightKg:        '',
    heightCm:        '',
    age:             '',
    sex:             'male',
    activity:        'moderate',
    measurementDate: getTodayDate(),
  });
  const [touched,     setTouched]     = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [error,       setError]       = useState(null);
  const [success,     setSuccess]     = useState(false);
  const [loading,     setLoading]     = useState(false);

  // Pre-populate from the last logged measurement when it loads
  useEffect(() => {
    if (!lastMeasurement) return;
    setForm(prev => ({
      ...prev,
      weightKg: lastMeasurement.weight_kg      ?? prev.weightKg,
      heightCm: lastMeasurement.height_cm      ?? prev.heightCm,
      age:      lastMeasurement.age            ?? prev.age,
      sex:      lastMeasurement.sex            ?? prev.sex,
      activity: lastMeasurement.activity_level ?? prev.activity,
    }));
  }, [lastMeasurement?.id]);

  const patch = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleBlur = (field) => (e) => {
    if (!RULES[field]) return;
    setTouched(prev => ({ ...prev, [field]: true }));
    setFieldErrors(prev => ({ ...prev, [field]: validateField(field, e.target.value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate all numeric fields at once and surface inline errors
    const errors = {};
    Object.keys(RULES).forEach(field => {
      const err = validateField(field, form[field]);
      if (err) errors[field] = err;
    });

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({ weightKg: true, heightCm: true, age: true });
      setError('Review the fields below and correct any errors.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/measurements', {
        ...form,
        weightKg: parseFloat(form.weightKg),
        heightCm: parseFloat(form.heightCm),
        age:      parseInt(form.age, 10),
      });
      setSuccess(true);
      setFieldErrors({});
      setTouched({});
      setForm(prev => ({ ...prev, measurementDate: getTodayDate() }));
      setTimeout(() => setSuccess(false), 4000);
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="measurement-form" onSubmit={handleSubmit} noValidate>

      {error && (
        <div className="alert alert--error" role="alert">
          <IconAlertCircle />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert--success" role="status">
          <IconCheckCircle />
          <span>Logged successfully.</span>
        </div>
      )}

      <FormGroup id="measurementDate" label="Date">
        <input
          id="measurementDate"
          className="form-input"
          type="date"
          value={form.measurementDate}
          onChange={patch('measurementDate')}
          max={getTodayDate()}
          required
        />
      </FormGroup>

      <div className="form-row">
        <FormGroup id="weightKg" label="Weight" hint="kg" error={touched.weightKg ? fieldErrors.weightKg : null}>
          <input
            id="weightKg"
            className="form-input"
            type="number"
            inputMode="decimal"
            value={form.weightKg}
            onChange={patch('weightKg')}
            onBlur={handleBlur('weightKg')}
            placeholder="70.0"
            min="1"
            max="500"
            step="0.1"
            required
          />
        </FormGroup>

        <FormGroup id="heightCm" label="Height" hint="cm" error={touched.heightCm ? fieldErrors.heightCm : null}>
          <input
            id="heightCm"
            className="form-input"
            type="number"
            inputMode="decimal"
            value={form.heightCm}
            onChange={patch('heightCm')}
            onBlur={handleBlur('heightCm')}
            placeholder="175"
            min="50"
            max="300"
            step="0.1"
            required
          />
        </FormGroup>

        <FormGroup id="age" label="Age" hint="yrs" error={touched.age ? fieldErrors.age : null}>
          <input
            id="age"
            className="form-input"
            type="number"
            inputMode="numeric"
            value={form.age}
            onChange={patch('age')}
            onBlur={handleBlur('age')}
            placeholder="30"
            min="1"
            max="150"
            required
          />
        </FormGroup>
      </div>

      <div className="form-row form-row--2">
        <FormGroup id="sex" label="Biological Sex">
          <select id="sex" className="form-select" value={form.sex} onChange={patch('sex')} required>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </FormGroup>

        <FormGroup id="activity" label="Activity Level">
          <select id="activity" className="form-select" value={form.activity} onChange={patch('activity')} required>
            {ACTIVITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label} — {opt.description}</option>
            ))}
          </select>
        </FormGroup>
      </div>

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="btn-spinner" aria-hidden="true" />
            <span>Saving…</span>
          </>
        ) : (
          <>
            <IconPlus />
            <span>Log Measurement</span>
          </>
        )}
      </button>

    </form>
  );
}
