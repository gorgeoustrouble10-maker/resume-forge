interface StepperProps {
  current: number;
  steps: string[];
}

const Stepper = ({ current, steps }: StepperProps) => {
  return (
    <ol className="stepper">
      {steps.map((label, index) => {
        const status = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={label} className={`stepper__item stepper__item--${status}`}>
            <span className="stepper__dot">{index + 1}</span>
            <span className="stepper__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
};

export default Stepper;
