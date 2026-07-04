import { NextResponse } from 'next/server';
import { kvGet } from '../../kv';

export async function GET() {
  try {
    const monitors = (await kvGet<any[]>('golions_monitors')) || [];
    return NextResponse.json({ monitors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
