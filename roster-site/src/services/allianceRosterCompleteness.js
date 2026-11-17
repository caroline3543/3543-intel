/**
 * Missing alliance members may only be marked unverified when the provider
 * explicitly declares the returned roster complete.
 * HTTP success, list size and pagination assumptions are insufficient.
 */
export function isExplicitlyCompleteAllianceRoster(response){
 return response?.data?.complete===true || response?.data?.is_complete===true;
}
