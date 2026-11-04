'use client';

import React, { useEffect } from 'react';
import { reportClientError } from '@/lib/client/error-report';

/** Dernier filet : si la mise en page elle-même plante (rare), on garde un écran utilisable. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, 'Erreur globale');
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ maxWidth: 420, background: '#fff', borderRadius: 24, padding: 24, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.08)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>SchoolFlow redémarre</h2>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
              Vos données sont en sécurité dans la base. Appuyez sur le bouton pour recharger.
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  reset();
                } catch (e) {}
                window.location.reload();
              }}
              style={{ marginTop: 12, padding: '12px 20px', borderRadius: 12, border: 0, background: '#059669', color: '#fff', fontWeight: 700, fontSize: 14 }}
            >
              Recharger
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
