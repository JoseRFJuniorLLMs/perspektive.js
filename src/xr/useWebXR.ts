import { useEffect, useState, useCallback } from 'react';

/**
 * useWebXR — Neural Portal Hook.
 * Negotiates directly with VR hardware (Oculus Quest, Vision Pro, etc.)
 * as gifted by the user.
 */
export function useWebXR(glContext: WebGLRenderingContext | WebGL2RenderingContext | null) {
  const [isSupported, setIsSupported] = useState(false);
  const [xrSession, setXrSession] = useState<XRSession | null>(null);

  // 1. Check for XR support
  useEffect(() => {
    if ('xr' in navigator) {
      (navigator as any).xr?.isSessionSupported('immersive-vr').then((supported: boolean) => {
        setIsSupported(supported);
      });
    }
  }, []);

  // 2. The Ignition: Requesting the VR session
  const enterVR = useCallback(async () => {
    const nav = navigator as any;
    if (!nav.xr || !glContext) return;

    try {
      const session = await nav.xr.requestSession('immersive-vr');
      
      // Make GL context XR compatible
      await (glContext as any).makeXRCompatible();
      
      // Bind WebGL to the headset lenses
      session.updateRenderState({
        baseLayer: new (window as any).XRWebGLLayer(session, glContext),
      });

      setXrSession(session);

      session.addEventListener('end', () => {
        setXrSession(null);
      });

    } catch (err) {
      console.error("The immersion failed. The mind refused the connection:", err);
    }
  }, [glContext]);

  return { isSupported, xrSession, enterVR };
}
