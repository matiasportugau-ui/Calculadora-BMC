import PanelinCalculadora from './components/PanelinCalculadoraV3';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <PanelinCalculadora />
    </ErrorBoundary>
  );
}
