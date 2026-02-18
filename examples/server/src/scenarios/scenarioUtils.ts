export const getUserId = (): string => {
  return "user1";
};

export const getTenantIdByUserId = async (userId: string): Promise<string> => {
  if (userId === "user1") {
    return "tenant1";
  }
  return "tenant2";
};

export const getStoreIdsByTenantId = async (tenantId: string): Promise<string[]> => {
  if (tenantId === "tenant1") {
    return ["store1", "store2"];
  }
  return ["store3", "store4"];
};
