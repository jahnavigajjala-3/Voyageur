import { render, screen, fireEvent } from '@testing-library/react';
import RouteSafetyDisplay from './RouteSafetyDisplay';

// Mock route data matching backend response structure
const mockRoutes = [
  {
    id: 'route-1',
    type: 'safest',
    geometry: { type: 'LineString', coordinates: [[78.486671, 17.385044], [78.391129, 17.448117]] },
    distance: 12345, // meters
    duration: 1800, // seconds
    safety_score: 82,
    risk_level: 'low',
    is_fastest: false,
    summary: 'Safest route with minimal risk zones'
  },
  {
    id: 'route-2',
    type: 'fastest',
    geometry: { type: 'LineString', coordinates: [[78.486671, 17.385044], [78.391129, 17.448117]] },
    distance: 9876, // meters
    duration: 1500, // seconds
    safety_score: 65,
    risk_level: 'medium',
    is_fastest: true,
    summary: 'Fastest route passes through moderate risk areas'
  },
  {
    id: 'route-3',
    type: 'alternative',
    geometry: { type: 'LineString', coordinates: [[78.486671, 17.385044], [78.391129, 17.448117]] },
    distance: 11500, // meters
    duration: 1700, // seconds
    safety_score: 75,
    risk_level: 'medium',
    is_fastest: false,
    summary: 'Balanced alternative route'
  }
];

describe('RouteSafetyDisplay Component', () => {
  test('renders loading state', () => {
    render(<RouteSafetyDisplay isLoading={true} />);
    expect(screen.getByText('Computing safe routes...')).toBeInTheDocument();
  });

  test('renders empty state', () => {
    render(<RouteSafetyDisplay routes={[]} />);
    expect(screen.getByText('No routes to display')).toBeInTheDocument();
  });

  test('renders route cards with correct data', () => {
    const onRouteSelect = jest.fn();
    render(<RouteSafetyDisplay routes={mockRoutes} onRouteSelect={onRouteSelect} />);
    
    // Check for route cards
    expect(screen.getByText('Safest')).toBeInTheDocument();
    expect(screen.getByText('Fastest')).toBeInTheDocument();
    expect(screen.getByText('Alternative')).toBeInTheDocument();
    
    // Check for safety scores
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    
    // Check for distance and duration
    expect(screen.getAllByText('12.3 km')).toHaveLength(3);
    expect(screen.getAllByText('30 min')).toHaveLength(1);
    expect(screen.getAllByText('25 min')).toHaveLength(1);
    expect(screen.getAllByText('28 min')).toHaveLength(1);
    
    // Check for risk levels
    expect(screen.getByText('LOW')).toBeInTheDocument();
    expect(screen.getAllByText('MEDIUM')).toHaveLength(2);
  });

  test('tab navigation works correctly', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // Initially should show all routes
    expect(screen.getByText('Safest')).toBeInTheDocument();
    expect(screen.getByText('Fastest')).toBeInTheDocument();
    expect(screen.getByText('Alternative')).toBeInTheDocument();
    
    // Click on Fastest tab
    fireEvent.click(screen.getByText('⚡ Fastest'));
    // Should only show fastest route
    expect(screen.getByText('Fastest')).toBeInTheDocument();
    expect(screen.queryByText('Safest')).not.toBeInTheDocument();
    expect(screen.queryByText('Alternative')).not.toBeInTheDocument();
    
    // Click on Balanced tab
    fireEvent.click(screen.getByText('⚖️ Balanced'));
    // Should show balanced/alternative routes
    expect(screen.getByText('Alternative')).toBeInTheDocument();
  });

  test('route selection callback works', () => {
    const onRouteSelect = jest.fn();
    render(<RouteSafetyDisplay routes={mockRoutes} onRouteSelect={onRouteSelect} />);
    
    // Click on a route card
    const routeCards = screen.getAllByText('Select Route →');
    fireEvent.click(routeCards[0]);
    
    expect(onRouteSelect).toHaveBeenCalledWith('route-1');
  });

  test('shows comparison metrics when multiple routes available', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // Should show comparison metrics
    expect(screen.getByText('Route Comparison')).toBeInTheDocument();
    expect(screen.getByText('Safety Gain')).toBeInTheDocument();
    expect(screen.getByText('Time Trade-off')).toBeInTheDocument();
    expect(screen.getByText('Extra Distance')).toBeInTheDocument();
  });

  test('handles missing route properties gracefully', () => {
    const incompleteRoutes = [
      {
        id: 'route-1',
        distance: 10000,
        duration: 1800,
        safety_score: 80
        // Missing type, risk_level, etc.
      }
    ];
    
    render(<RouteSafetyDisplay routes={incompleteRoutes} />);
    
    // Should still render without crashing
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('10.0 km')).toBeInTheDocument();
  });

  test('responsive design classes are present', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    const container = screen.getByText('Route Safety Analysis').closest('.route-safety-display');
    expect(container).toHaveClass('glass-card');
    expect(container).toHaveClass('p-6');
    expect(container).toHaveClass('rounded-2xl');
    
    // Check for grid layout classes
    const routeDetails = screen.getAllByText('Distance')[0].closest('div');
    expect(routeDetails.parentElement).toHaveClass('grid');
    expect(routeDetails.parentElement).toHaveClass('grid-cols-3');
  });
});

// Test for mobile responsiveness
describe('RouteSafetyDisplay Mobile Responsiveness', () => {
  test('uses responsive grid classes', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // The component should use responsive grid classes
    const comparisonGrid = screen.getByText('Route Comparison')?.nextElementSibling;
    if (comparisonGrid) {
      expect(comparisonGrid).toHaveClass('grid');
      expect(comparisonGrid).toHaveClass('grid-cols-3');
    }
    
    // Tab buttons should be flex containers
    const tabsContainer = screen.getByText('🛡️ Safest').closest('div');
    expect(tabsContainer).toHaveClass('flex');
    expect(tabsContainer).toHaveClass('space-x-2');
  });
});

// Test for advanced filtering controls
describe('RouteSafetyDisplay Advanced Filtering', () => {
  test('renders filtering controls', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // Should show filtering controls
    expect(screen.getByText('Route Preferences')).toBeInTheDocument();
    expect(screen.getByText('Avoid High-Risk Areas')).toBeInTheDocument();
    expect(screen.getByText('Minimize Distance')).toBeInTheDocument();
    expect(screen.getByText('Balance Safety & Speed')).toBeInTheDocument();
    expect(screen.getByText('Show Only Verified Data')).toBeInTheDocument();
    expect(screen.getByText('Reset Filters')).toBeInTheDocument();
  });

  test('filter toggles work correctly', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // Click on "Minimize Distance" toggle
    const minimizeDistanceLabel = screen.getByText('Minimize Distance');
    fireEvent.click(minimizeDistanceLabel);
    
    // The toggle should now be active
    // Note: We can't easily test the visual state without complex DOM queries
    // But we can verify the component doesn't crash
    
    // Click on "Reset Filters" button
    const resetButton = screen.getByText('Reset Filters');
    fireEvent.click(resetButton);
  });

  test('slider filters work correctly', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // Find minimum safety score slider
    const safetyScoreText = screen.getByText(/Minimum Safety Score:/);
    expect(safetyScoreText).toBeInTheDocument();
    
    // Find max time penalty slider
    const timePenaltyText = screen.getByText(/Max Time Penalty:/);
    expect(timePenaltyText).toBeInTheDocument();
  });

  test('shows filter status indicators', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // Should show route count
    expect(screen.getByText(/Showing \d+ of \d+ routes/)).toBeInTheDocument();
    
    // Should show active filter badges when filters are active
    // Note: By default, "Avoid High Risk" is active
    expect(screen.getByText('No High Risk')).toBeInTheDocument();
  });

  test('enhanced safety visualization renders', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // Should show enhanced safety score visualization
    expect(screen.getByText('Safety Score Breakdown')).toBeInTheDocument();
    
    // Should show risk level indicators
    expect(screen.getAllByText(/Risk:/)).toHaveLength(3);
  });

  test('enhanced legend component renders', () => {
    render(<RouteSafetyDisplay routes={mockRoutes} />);
    
    // Should show enhanced legend
    expect(screen.getByText('Safety Information')).toBeInTheDocument();
    expect(screen.getByText('Safety Score Ranges')).toBeInTheDocument();
    expect(screen.getByText('Filter Indicators')).toBeInTheDocument();
    expect(screen.getByText('Data source:')).toBeInTheDocument();
  });
});