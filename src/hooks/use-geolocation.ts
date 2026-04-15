"use client";

import { useState, useCallback } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: "位置情報が利用できません" }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        // Discard if accuracy > 100m
        if (accuracy > 100) {
          setState({
            latitude: null,
            longitude: null,
            accuracy: null,
            error: null,
            loading: false,
          });
          return;
        }
        setState({ latitude, longitude, accuracy, error: null, loading: false });
      },
      () => {
        // Silently fail - GPS is optional for notes
        setState({
          latitude: null,
          longitude: null,
          accuracy: null,
          error: null,
          loading: false,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return { ...state, requestLocation };
}
