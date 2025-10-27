export async function getUserOrders(userId: number) {
  const res = await fetch(`/users/${userId}/orders`);
  if (!res.ok) throw new Error("注文履歴の取得に失敗しました");
  return res.json();
}