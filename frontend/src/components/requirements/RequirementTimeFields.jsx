import {
  clampRequirementTimes,
  getEndSlotOptions,
  getStartSlotOptions,
  slotToTimeString,
  timeToSlot,
} from '../../utils/workingHours';

export default function RequirementTimeFields({
  startTime,
  endTime,
  workingHours,
  onStartChange,
  onEndChange,
  startLabel,
  endLabel,
  Field,
  labelStyle,
  inputStyle,
}) {
  if (!workingHours) {
    return null;
  }

  const startSlot = timeToSlot(startTime);
  const endSlot = timeToSlot(endTime);
  const startOptions = getStartSlotOptions(workingHours);
  const endOptions = getEndSlotOptions(workingHours, startSlot);

  const handleStartChange = (nextStartSlot) => {
    const clamped = clampRequirementTimes(
      slotToTimeString(nextStartSlot),
      endTime,
      workingHours,
    );
    onStartChange(clamped.start_time, clamped.end_time);
  };

  const handleEndChange = (nextEndSlot) => {
    onEndChange(slotToTimeString(nextEndSlot));
  };

  return (
    <>
      <Field label={startLabel} labelStyle={labelStyle}>
        <select
          value={startSlot}
          onChange={(event) => handleStartChange(Number(event.target.value))}
          style={inputStyle}
        >
          {startOptions.map((option) => (
            <option key={option.slot} value={option.slot}>{option.label}</option>
          ))}
        </select>
      </Field>

      <Field label={endLabel} labelStyle={labelStyle}>
        <select
          value={endSlot}
          onChange={(event) => handleEndChange(Number(event.target.value))}
          style={inputStyle}
          disabled={endOptions.length === 0}
        >
          {endOptions.map((option) => (
            <option key={option.slot} value={option.slot}>{option.label}</option>
          ))}
        </select>
      </Field>
    </>
  );
}
