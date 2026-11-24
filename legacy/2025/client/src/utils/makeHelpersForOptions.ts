/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { typedGroupBy } from './objects';

/**
 * Creates utility functions to work with an array of options.
 * Primarily a `getFn` and `useGetHook`, that return the option object based on the key, or a fallback value if the key is not found.
 *
 * @param dataArray - Array of objects, must be defined using `as const` to ensure type safety.
 * @param key - The key to group the array by
 */
export function makeHelpersForOptions<
  K extends string,
  Fallback extends { [key in K]: string | null | undefined } & {
    [k in string]: unknown;
  },
  TArray extends readonly ({ [key in K]: string } & Fallback)[],
>(
  key: K,
  makeFallback: (key: string | null | undefined) => Fallback,
  dataArray: TArray
) {
  const dataObject = typedGroupBy<K, TArray[number]>(dataArray, key);

  function getFn<T extends TArray[number][K]>(
    status: T
  ): Extract<TArray[number], { [key in K]: T }>;
  function getFn<T extends string | null | undefined>(
    status: T
  ): Fallback | Extract<TArray[number], { [key in K]: T }>;
  function getFn<T extends string | null | undefined>(
    status: T
  ): Fallback | Extract<TArray[number], { [key in K]: T }> {
    return typeof status === 'string' && status in dataObject
      ? dataObject[status as unknown as keyof typeof dataObject]
      : makeFallback(status);
  }

  const useGetHook: typeof getFn = ((status: any) => {
    return useMemo(() => getFn(status), [status]);
  }) as typeof getFn;

  const exposedMakeFallback = <O extends Omit<Partial<Fallback>, K>>(
    status: Parameters<typeof makeFallback>[0],
    options?: O
  ) => {
    return {
      ...makeFallback(status),
      ...options,
    } as Fallback & O;
  };

  return {
    dataArray: dataArray,
    dataObject: dataObject,
    /** Gets the info by key, if not found, returns a fallback value */
    getFn: getFn,
    /** Gets the info by key, if not found, returns a fallback value */
    useGetHook: useGetHook,
    /** Generates a fallback value */
    makeFallback: exposedMakeFallback,
  };
}
