interface MapOverlayProps {
  variant: "empty" | "error";
  message?: string;
}

export function MapOverlay({ variant, message }: MapOverlayProps) {
  if (variant === "empty") {
    return (
      <div className="map-overlay" role="status">
        <strong>No locations in this view</strong>
        <p>Try zooming out, panning, or clearing filters to see stores in this area.</p>
      </div>
    );
  }

  return (
    <div className="map-overlay map-overlay--error" role="alert">
      <strong>Could not load map data</strong>
      <p>{message ?? "Check that the backend is running on port 4000."}</p>
    </div>
  );
}
