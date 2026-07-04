import { NextResponse } from 'next/server';
import { kvGet } from '../../kv';

export async function GET() {
  try {
    const logs = (await kvGet<any[]>('golions_logs')) || [];
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
