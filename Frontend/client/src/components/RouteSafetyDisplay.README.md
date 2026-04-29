# RouteSafetyDisplay Component

A React component for displaying and comparing route safety information with tabbed interface and interactive route selection.

## Features

- **Route Cards**: Display route information with safety scores, risk levels, distance, and duration
- **Tabbed Interface**: Switch between Safest, Fastest, and Balanced route views
- **Comparison Metrics**: Show safety differences and trade-offs between routes
- **Route Selection**: Interactive route selection with callbacks
- **Responsive Design**: Works on mobile and desktop screens
- **Safety Visualization**: Color-coded safety scores and risk levels

## Installation

The component is already included in the project. Import it as:

```jsx
import RouteSafetyDisplay from './components/RouteSafetyDisplay';
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `routes` | `Array` | `[]` | Array of route objects (see Data Structure below) |
| `onRouteSelect` | `Function` | `null` | Callback fired when a route is selected |
| `activeRouteId` | `string` | `null` | ID of the currently active/selected route |
| `isLoading` | `boolean` | `false` | Show loading state while computing routes |

## Data Structure

Routes should match the backend response format from `/routes/safe` endpoint:

```javascript
{
  id: 'route-1',                    // Unique identifier
  type: 'safest',                   // 'safest', 'fastest', or 'alternative'
  geometry: { /* GeoJSON */ },      // Route geometry
  distance: 12345,                  // Distance in meters
  duration: 1800,                   // Duration in seconds
  safety_score: 82,                 // Safety score (0-100)
  risk_level: 'low',                // 'low', 'medium', or 'high'
  is_fastest: false,                // Whether this is the fastest route
  summary: 'Route description'      // Optional route summary
}
```

## Usage Example

```jsx
import { useState } from 'react';
import RouteSafetyDisplay from './components/RouteSafetyDisplay';

function RoutePlanning() {
  const [routes, setRoutes] = useState([]);
  const [activeRouteId, setActiveRouteId] = useState(null);

  // Example routes data
  const exampleRoutes = [
    {
      id: 'route-1',
      type: 'safest',
      distance: 12345,
      duration: 1800,
      safety_score: 82,
      risk_level: 'low',
      is_fastest: false,
      summary: 'Safest route with minimal risk zones'
    },
    {
      id: 'route-2',
      type: 'fastest',
      distance: 9876,
      duration: 1500,
      safety_score: 65,
      risk_level: 'medium',
      is_fastest: true,
      summary: 'Fastest route passes through moderate risk areas'
    }
  ];

  const handleRouteSelect = (routeId) => {
    setActiveRouteId(routeId);
    // Highlight route on map, update UI, etc.
  };

  return (
    <RouteSafetyDisplay
      routes={exampleRoutes}
      onRouteSelect={handleRouteSelect}
      activeRouteId={activeRouteId}
    />
  );
}
```

## Integration with CrimeMap

The component is designed to work seamlessly with the existing CrimeMap component:

```jsx
import { useRef, useState } from 'react';
import CrimeMap from './CrimeMap';
import RouteSafetyDisplay from './RouteSafetyDisplay';

function IntegratedRoutePlanning() {
  const crimeMapRef = useRef(null);
  const [routes, setRoutes] = useState([]);
  const [activeRouteId, setActiveRouteId] = useState(null);

  const handleRouteSelect = (routeId) => {
    setActiveRouteId(routeId);
    // Highlight route on the map
    if (crimeMapRef.current) {
      crimeMapRef.current.selectRoute(routeId);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="h-[500px]">
        <CrimeMap ref={crimeMapRef} />
      </div>
      <div>
        <RouteSafetyDisplay
          routes={routes}
          onRouteSelect={handleRouteSelect}
          activeRouteId={activeRouteId}
        />
      </div>
    </div>
  );
}
```

## Styling

The component uses Tailwind CSS classes and follows the project's design system:

- **Glass Card Effect**: Semi-transparent background with blur
- **Color Coding**: 
  - Green (80-100): Very safe
  - Yellow (50-79): Moderate risk  
  - Red (0-49): High risk
- **Interactive States**: Hover effects and active state highlighting
- **Responsive Grid**: Adapts to different screen sizes

## Responsive Behavior

- **Desktop**: Two-column layout with detailed route information
- **Tablet**: Single column with adjusted spacing
- **Mobile**: Compact view with touch-friendly controls

## Testing

Run the included test suite:

```bash
npm test -- RouteSafetyDisplay.test.jsx
```

Or run all component tests:

```bash
npm test
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Color Contrast**: Meets WCAG 2.1 AA standards
- **Focus Management**: Clear focus indicators for interactive elements

## Performance

- **Virtualization**: Handles large numbers of routes efficiently
- **Memoization**: Uses React.memo for performance optimization
- **Lazy Loading**: Components load only when needed
- **Bundle Size**: Minimal dependencies, tree-shakeable

## Error Handling

- **Missing Data**: Gracefully handles missing route properties
- **Empty State**: Shows helpful message when no routes available
- **Loading State**: Displays loading indicator during computation
- **Network Errors**: Handles API failures gracefully

## Development

### Building from Source

```bash
cd Frontend/client
npm install
npm run dev
```

### Running Tests

```bash
cd Frontend/client
npm test
```

### Code Style

Follows the project's ESLint configuration and Prettier formatting.

## License

Part of the Voyageur project. See project LICENSE for details.

## Changelog

### v1.0.0
- Initial release
- Route cards with safety information
- Tabbed interface (Safest/Fastest/Balanced)
- Comparison metrics display
- Route selection callbacks
- Responsive design

## Contributing

See the main project CONTRIBUTING.md for guidelines.

## Support

For issues or questions, please open an issue in the project repository.