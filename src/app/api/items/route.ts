import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const queryCategory = searchParams.get('category');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  try {
    // 1. ユーザー設定の取得 (連携カテゴリ制限があるかチェック)
    let allowedCategories: string[] = [];
    const settingsRef = doc(db, 'settings', userId);
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      const settingsData = settingsSnap.data();
      const haccpCategories = settingsData.haccpCategories as string || '';
      if (haccpCategories.trim()) {
        allowedCategories = haccpCategories.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    // 2. 商品一覧の取得
    const itemsRef = collection(db, 'items');
    const q = query(itemsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    let items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 3. 連携カテゴリ制限フィルタの適用
    if (allowedCategories.length > 0) {
      items = items.filter((item: any) => 
        item.category && allowedCategories.some(cat => item.category.toLowerCase() === cat.toLowerCase())
      );
    }

    // 4. クエリパラメータ指定カテゴリフィルタの適用
    if (queryCategory) {
      items = items.filter((item: any) => 
        item.category && item.category.toLowerCase() === queryCategory.toLowerCase()
      );
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching items API:', error);
    return NextResponse.json({ error: 'Failed to fetch items', details: error.message }, { status: 500 });
  }
}
