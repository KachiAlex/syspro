'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, QrCode, Home, X, Plus, RefreshCw } from 'lucide-react';
import { parseCoordsFromUrl } from '@/lib/geo-utils';

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  active: boolean;
}

interface RemoteDayRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  work_date: string;
  reason: string | null;
  status: string;
}

/**
 * Office geofence + rotating QR management and remote-day approvals.
 * Shared between /tenant-admin/hr/attendance and the embedded HR attendance tab.
 */
export function AttendanceVerificationPanel({ tenantSlug }: { tenantSlug?: string }) {
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [remoteRequests, setRemoteRequests] = useState<RemoteDayRequest[]>([]);
  const [qrFor, setQrFor] = useState<{ id: string; name: string; dataUrl: string; expiresAt: string } | null>(null);
  const [locForm, setLocForm] = useState({ name: '', latitude: '', longitude: '', radiusM: '500' });
  const [locSaving, setLocSaving] = useState(false);
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapsLink, setMapsLink] = useState('');
  const [linkResolving, setLinkResolving] = useState(false);

  const applyCoords = (lat: number, lng: number) => {
    setLocForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
    setGeoError(null);
  };

  const handleMapsLink = async (value: string) => {
    setMapsLink(value);
    const url = value.trim();
    if (!url) return;
    // Try local parse first (full maps URLs carry coords in @lat,lng / !3d!4d / ?q=)
    const local = parseCoordsFromUrl(url);
    if (local) {
      applyCoords(local.latitude, local.longitude);
      return;
    }
    // Short links (maps.app.goo.gl / goo.gl) need server-side expansion
    if (!tenantSlug || !/(^|\.)goo\.gl|google\.[a-z.]+\/maps/i.test(url)) return;
    setLinkResolving(true);
    setGeoError(null);
    try {
      const res = await fetch(`/api/attendance/locations/resolve-link?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) applyCoords(d.latitude, d.longitude);
      else setGeoError(d.error || 'Could not read coordinates from that link');
    } catch {
      setGeoError('Could not resolve that link. Open it in a browser, then copy the full URL.');
    } finally {
      setLinkResolving(false);
    }
  };

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    const [locRes, remRes] = await Promise.all([
      fetch(`/api/attendance/locations?tenantSlug=${encodeURIComponent(tenantSlug)}`).then(r => r.ok ? r.json() : { locations: [] }).catch(() => ({ locations: [] })),
      fetch(`/api/attendance/remote-days?tenantSlug=${encodeURIComponent(tenantSlug)}&status=pending`).then(r => r.ok ? r.json() : { requests: [] }).catch(() => ({ requests: [] })),
    ]);
    setLocations(locRes.locations || []);
    setRemoteRequests(remRes.requests || []);
  }, [tenantSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const addLocation = async () => {
    if (!tenantSlug || !locForm.name || !locForm.latitude || !locForm.longitude) return;
    setLocSaving(true);
    try {
      const res = await fetch(`/api/attendance/locations?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: locForm.name,
          latitude: Number(locForm.latitude),
          longitude: Number(locForm.longitude),
          radiusM: Number(locForm.radiusM),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setLocations(prev => [...prev, d.location]);
        setLocForm({ name: '', latitude: '', longitude: '', radiusM: '500' });
        setMapsLink('');
      } else {
        alert(d.error || 'Failed to add location');
      }
    } finally {
      setLocSaving(false);
    }
  };

  const fillMyLocation = () => {
    setGeoError(null);
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setGeoError('GPS only works on HTTPS. Open the site via its https:// URL (not http:// or the raw IP).');
      return;
    }
    if (!navigator.geolocation) {
      setGeoError('This browser does not support geolocation. Enter coordinates manually (right-click the office in Google Maps).');
      return;
    }
    setUseMyLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setUseMyLocation(false);
      },
      (err) => {
        setUseMyLocation(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Click the lock/location icon in the address bar and allow access, then retry.'
            : err.code === err.TIMEOUT
              ? 'Timed out getting GPS. Move near a window or enter coordinates manually.'
              : 'Could not get your location. Enter coordinates manually instead.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const deleteLocation = async (id: string) => {
    if (!tenantSlug) return;
    await fetch(`/api/attendance/locations/${id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, { method: 'DELETE' });
    setLocations(prev => prev.filter(l => l.id !== id));
  };

  const showQr = async (loc: OfficeLocation) => {
    if (!tenantSlug) return;
    const res = await fetch(`/api/attendance/locations/${loc.id}/qr?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) setQrFor({ id: loc.id, name: loc.name, dataUrl: d.qrDataUrl, expiresAt: d.expiresAt });
    else alert(d.error || 'Failed to generate QR');
  };

  const downloadQr = () => {
    if (!qrFor) return;
    const a = document.createElement('a');
    a.href = qrFor.dataUrl;
    a.download = `${qrFor.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-checkin-qr.png`;
    a.click();
  };

  const decideRemote = async (id: string, status: 'approved' | 'rejected') => {
    if (!tenantSlug) return;
    const res = await fetch(`/api/attendance/remote-days/${id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setRemoteRequests(prev => prev.filter(r => r.id !== id));
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h4 className="font-semibold text-theme-text-primary mb-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" /> Office Locations &amp; QR Check-in
          </h4>
          <p className="text-xs text-theme-text-secondary mb-4">
            Onsite employees scan a rotating QR code; check-ins beyond the radius are flagged for review.
          </p>

          {locations.length > 0 ? (
            <div className="space-y-2 mb-4">
              {locations.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between p-3 border border-theme-border rounded-lg">
                  <div>
                    <p className="font-medium text-theme-text-primary text-sm">{loc.name}</p>
                    <p className="text-xs text-theme-text-secondary">
                      {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)} · {loc.radius_m}m radius
                      {!loc.active && ' · inactive'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => showQr(loc)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-400 bg-blue-500/10 rounded hover:bg-blue-500/20"
                    >
                      <QrCode className="w-3 h-3" /> QR
                    </button>
                    <button
                      onClick={() => deleteLocation(loc.id)}
                      className="px-2 py-1 text-xs font-medium text-red-400 bg-red-500/10 rounded hover:bg-red-500/20"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-theme-text-secondary mb-4">No office locations configured yet.</p>
          )}

          <div className="border-t border-theme-border pt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text" placeholder="Office name" value={locForm.name}
                onChange={(e) => setLocForm(f => ({ ...f, name: e.target.value }))}
                className="col-span-2 px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-sm text-theme-text-primary"
              />
              <input
                type="url" placeholder={linkResolving ? 'Resolving link…' : 'Paste Google Maps link (auto-fills coordinates)'}
                value={mapsLink}
                onChange={(e) => handleMapsLink(e.target.value)}
                disabled={linkResolving}
                className="col-span-2 px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-sm text-theme-text-primary"
              />
              <input
                type="number" step="any" placeholder="Latitude" value={locForm.latitude}
                onChange={(e) => setLocForm(f => ({ ...f, latitude: e.target.value }))}
                className="px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-sm text-theme-text-primary"
              />
              <input
                type="number" step="any" placeholder="Longitude" value={locForm.longitude}
                onChange={(e) => setLocForm(f => ({ ...f, longitude: e.target.value }))}
                className="px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-sm text-theme-text-primary"
              />
              <input
                type="number" placeholder="Radius (m)" value={locForm.radiusM}
                onChange={(e) => setLocForm(f => ({ ...f, radiusM: e.target.value }))}
                className="px-3 py-2 bg-theme-bg border border-theme-border rounded-lg text-sm text-theme-text-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fillMyLocation}
                  disabled={useMyLocation}
                  className="px-2 py-2 text-xs font-medium text-theme-text-primary bg-theme-bg border border-theme-border rounded-lg hover:bg-theme-sidebar-hover disabled:opacity-50"
                  title="Fill coordinates from this device's GPS"
                >
                  {useMyLocation ? '…' : 'Use GPS'}
                </button>
                <button
                  onClick={addLocation}
                  disabled={locSaving || !locForm.name || !locForm.latitude || !locForm.longitude}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
            {geoError && <p className="text-xs text-red-400">{geoError}</p>}
            <p className="text-xs text-theme-text-secondary">
              Tip: paste a Google Maps link (Share → Copy link works too), tap “Use GPS” at the office, or type coordinates manually.
            </p>
          </div>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h4 className="font-semibold text-theme-text-primary mb-1 flex items-center gap-2">
            <Home className="w-4 h-4 text-purple-400" /> Remote Day Requests
          </h4>
          <p className="text-xs text-theme-text-secondary mb-4">
            Remote/Hybrid employees can only check in remotely on approved days.
          </p>
          {remoteRequests.length > 0 ? (
            <div className="space-y-3">
              {remoteRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 border border-theme-border rounded-lg">
                  <div>
                    <p className="font-medium text-theme-text-primary">{req.employee_name}</p>
                    <p className="text-xs text-theme-text-secondary">
                      {new Date(req.work_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {req.reason ? ` · ${req.reason}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => decideRemote(req.id, 'approved')}
                      className="px-2 py-1 text-xs font-medium text-green-400 bg-green-500/10 rounded hover:bg-green-500/20"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decideRemote(req.id, 'rejected')}
                      className="px-2 py-1 text-xs font-medium text-red-400 bg-red-500/10 rounded hover:bg-red-500/20"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-theme-text-secondary">No pending remote-day requests.</p>
          )}
        </div>
      </div>

      {qrFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setQrFor(null)}>
          <div className="bg-theme-surface rounded-xl shadow-xl border border-theme-border p-6 max-w-sm w-full mx-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-theme-text-primary">{qrFor.name} — Today&apos;s QR</h3>
              <button onClick={() => setQrFor(null)} className="text-theme-text-secondary hover:text-theme-text-primary"><X className="w-5 h-5" /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrFor.dataUrl} alt="Check-in QR code" className="mx-auto w-64 h-64 border border-theme-border rounded-lg bg-white p-2" />
            <p className="text-xs text-theme-text-secondary mt-3">
              Valid until {new Date(qrFor.expiresAt).toLocaleString()}. Generating a new code invalidates this one.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={downloadQr}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Download PNG
              </button>
              <button
                onClick={() => {
                  const loc = locations.find(l => l.id === qrFor.id);
                  if (loc) showQr(loc);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20"
              >
                <RefreshCw className="w-3 h-3" /> Regenerate (rotates code)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
