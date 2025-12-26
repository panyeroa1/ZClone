import { auth } from '@clerk/nextjs/server';
import { addSseController, removeSseController } from '@/lib/stt/deepgramSessionStore';

export const runtime = 'nodejs';

const encoder = new TextEncoder();

export async function GET(req: Request) {
  const { userId } = auth();
  if (!userId) return new Response('unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id') || '';
  if (!sessionId) return new Response('session_id_required', { status: 400 });

  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      const session = addSseController(sessionId, controller);
      if (!session) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'session_not_found' })}\n\n`));
        controller.close();
        return;
      }

      heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // ignore
        }
      }, 15000);
    },
    cancel(_reason) {
      if (heartbeatId) clearInterval(heartbeatId);
      heartbeatId = null;
      if (controllerRef) removeSseController(sessionId, controllerRef);
      controllerRef = null;
    },
  });

  const response = new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });

  req.signal.addEventListener('abort', () => {
    if (heartbeatId) clearInterval(heartbeatId);
    heartbeatId = null;
    if (controllerRef) removeSseController(sessionId, controllerRef);
    controllerRef = null;
  });

  return response;
}
