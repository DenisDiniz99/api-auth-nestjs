/** ISP: interface coesa e mínima para hashing — DIP permite trocar bcrypt por outro algoritmo */
export interface IHashingService {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export const HASHING_SERVICE = Symbol('HASHING_SERVICE');
