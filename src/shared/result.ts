/**
 * Typed Result pattern for error handling as recommended by the engineering guide
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E extends Error = Error> = { ok: false; error: E };
export type Result<T, E extends Error = Error> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
    return { ok: true, value };
}

export function err<E extends Error>(error: E): Err<E> {
    return { ok: false, error };
}

export function isOk<T, E extends Error>(result: Result<T, E>): result is Ok<T> {
    return result.ok;
}

export function isErr<T, E extends Error>(result: Result<T, E>): result is Err<E> {
    return !result.ok;
}
