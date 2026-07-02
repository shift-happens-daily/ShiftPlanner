import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeAvailabilityStatus,
  getAvailabilityStyle,
  getPositionLabel,
  getBranchLabel,
  DEFAULT_STATUS_STYLE,
  DEFAULT_POSITION_STYLE,
  DEFAULT_AVAILABILITY_STYLE,
} from './employeeDisplay.js';

describe('employeeDisplay', () => {
  describe('normalizeAvailabilityStatus', () => {
    it('keeps known statuses unchanged', () => {
      assert.strictEqual(normalizeAvailabilityStatus('available'), 'available');
      assert.strictEqual(normalizeAvailabilityStatus('if_needed'), 'if_needed');
      assert.strictEqual(normalizeAvailabilityStatus('unavailable'), 'unavailable');
    });

    it('maps legacy "maybe" to "if_needed"', () => {
      assert.strictEqual(normalizeAvailabilityStatus('maybe'), 'if_needed');
    });

    it('falls back to unavailable for null, undefined or unknown statuses', () => {
      assert.strictEqual(normalizeAvailabilityStatus(null), 'unavailable');
      assert.strictEqual(normalizeAvailabilityStatus(undefined), 'unavailable');
      assert.strictEqual(normalizeAvailabilityStatus(''), 'unavailable');
      assert.strictEqual(normalizeAvailabilityStatus('new_api_status'), 'unavailable');
    });
  });

  describe('getAvailabilityStyle', () => {
    const styleMap = {
      available: { background: '#4CAF50', border: 0 },
      if_needed: { background: '#FFC107', border: 0 },
      unavailable: { background: '#eef3f6', border: 0 },
    };

    it('returns the mapped style for known statuses', () => {
      assert.deepStrictEqual(getAvailabilityStyle('available', styleMap), styleMap.available);
      assert.deepStrictEqual(getAvailabilityStyle('if_needed', styleMap), styleMap.if_needed);
      assert.deepStrictEqual(getAvailabilityStyle('unavailable', styleMap), styleMap.unavailable);
    });

    it('normalizes status before lookup', () => {
      assert.deepStrictEqual(getAvailabilityStyle('maybe', styleMap), styleMap.if_needed);
    });

    it('returns a safe style for unknown or missing statuses', () => {
      // Unknown API values normalize to 'unavailable' and pick that style when present.
      assert.deepStrictEqual(getAvailabilityStyle('totally_new_status', styleMap), styleMap.unavailable);
      assert.deepStrictEqual(getAvailabilityStyle(null, styleMap), styleMap.unavailable);
      assert.deepStrictEqual(getAvailabilityStyle(undefined, styleMap), styleMap.unavailable);
    });

    it('returns default style when the style map lacks the normalized status', () => {
      const partialMap = { if_needed: { background: '#FFC107' } };
      assert.deepStrictEqual(getAvailabilityStyle('available', partialMap), DEFAULT_AVAILABILITY_STYLE);
      assert.deepStrictEqual(getAvailabilityStyle('unavailable', partialMap), DEFAULT_AVAILABILITY_STYLE);
    });

    it('does not throw when styleMap is omitted', () => {
      assert.deepStrictEqual(getAvailabilityStyle('available'), DEFAULT_AVAILABILITY_STYLE);
    });

    it('returns a style with a safe border property', () => {
      const style = getAvailabilityStyle('unknown', styleMap);
      assert.ok(style && typeof style.border !== 'undefined');
    });
  });

  describe('getPositionLabel', () => {
    it('picks title, name or position_title', () => {
      assert.strictEqual(getPositionLabel({ title: 'Barista' }), 'Barista');
      assert.strictEqual(getPositionLabel({ name: 'Waiter' }), 'Waiter');
      assert.strictEqual(getPositionLabel({ position_title: 'Manager' }), 'Manager');
    });

    it('returns fallback for null, empty or title-less position', () => {
      assert.strictEqual(getPositionLabel(null), 'Без позиции');
      assert.strictEqual(getPositionLabel({}), 'Без позиции');
      assert.strictEqual(getPositionLabel(null, 'No position'), 'No position');
    });
  });

  describe('getBranchLabel', () => {
    it('returns the provided label when present', () => {
      assert.strictEqual(getBranchLabel('Moscow'), 'Moscow');
    });

    it('returns fallback for empty, null or undefined branch label', () => {
      assert.strictEqual(getBranchLabel(''), 'Без филиала');
      assert.strictEqual(getBranchLabel(null), 'Без филиала');
      assert.strictEqual(getBranchLabel(undefined), 'Без филиала');
      assert.strictEqual(getBranchLabel('', 'No branch'), 'No branch');
    });
  });

  describe('DEFAULT_STYLE exports', () => {
    it('DEFAULT_STATUS_STYLE has a border property', () => {
      assert.ok(DEFAULT_STATUS_STYLE.border);
    });

    it('DEFAULT_POSITION_STYLE has a border property', () => {
      assert.ok(DEFAULT_POSITION_STYLE.border);
    });

    it('DEFAULT_AVAILABILITY_STYLE has a border property', () => {
      assert.ok(typeof DEFAULT_AVAILABILITY_STYLE.border !== 'undefined');
    });
  });
});
