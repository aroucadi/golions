import { NextResponse } from 'next/server';
import { kvGet, kvSet } from '../../kv';

export async function POST(request: Request) {
  try {
    const { route, date } = await request.json();
    if (!route || !date) {
      return NextResponse.json({ error: 'Missing route or date' }, { status: 400 });
    }

    const monitors = (await kvGet<any[]>('golions_monitors')) || [];
    const filtered = monitors.filter((m) => !(m.route === route && m.date === date));
    
    await kvSet('golions_monitors', filtered);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
