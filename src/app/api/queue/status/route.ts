import { NextResponse } from 'next/server';
import { kvGet } from '../../kv';

export async function GET() {
  try {
    const queue = (await kvGet<any>('golions_queue')) || { detected: false, provider: 'NONE' };
    return NextResponse.json(queue);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
