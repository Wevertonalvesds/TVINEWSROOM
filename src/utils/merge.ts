import { ProgramState, Block, Lauda } from '../types';

/**
 * 3-Way Merge Algorithm for Teleprompter Program Rundown (Espelho)
 * - Base: The last state known to be in sync with the database.
 * - Local: The current state of the local client (may contain unsaved typing/edits).
 * - Cloud: The new state received from the database (may contain other users' edits).
 */
export function mergeProgramState(
  local: ProgramState,
  cloud: ProgramState,
  base: ProgramState | null
): ProgramState {
  if (!base) {
    // If we don't have a baseline, we cannot run 3-way merge safely.
    // Fallback to local if it has values, otherwise cloud.
    return cloud;
  }

  // Merge top-level metadata
  const nomePrograma = mergeField(local.nomePrograma, cloud.nomePrograma, base.nomePrograma);
  const editorChefe = mergeField(local.editorChefe || '', cloud.editorChefe || '', base.editorChefe || '');
  const tempoPrograma = mergeField(local.tempoPrograma, cloud.tempoPrograma, base.tempoPrograma);
  const dataPrograma = mergeField(local.dataPrograma || '', cloud.dataPrograma || '', base.dataPrograma || '');

  // Merge Blocks
  const mergedBlocos = mergeBlocks(local.blocos, cloud.blocos, base.blocos);

  return {
    nomePrograma,
    editorChefe,
    tempoPrograma,
    dataPrograma,
    blocos: mergedBlocos,
    teleprompterActiveLaudaId: cloud.teleprompterActiveLaudaId ?? local.teleprompterActiveLaudaId
  };
}

function isEqualValue(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === undefined && b === undefined) return true;
  if (a === null && b === null) return true;
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  }
  return false;
}

function isLaudaEqual(a: Lauda, b: Lauda): boolean {
  return (
    a.id === b.id &&
    (a.materia || '') === (b.materia || '') &&
    (a.duracao || '') === (b.duracao || '') &&
    (a.tipo || '') === (b.tipo || '') &&
    (a.apresentador || '') === (b.apresentador || '') &&
    (a.laudaContent || '') === (b.laudaContent || '') &&
    (a.driveLink || '') === (b.driveLink || '') &&
    !!a.aprovado === !!b.aprovado &&
    (a.gc || '') === (b.gc || '') &&
    isEqualValue(a.gcs || [], b.gcs || [])
  );
}

function mergeField<T>(localVal: T, cloudVal: T, baseVal: T): T {
  const localChanged = !isEqualValue(localVal, baseVal);
  const cloudChanged = !isEqualValue(cloudVal, baseVal);

  if (localChanged && !cloudChanged) {
    return localVal;
  }
  if (cloudChanged && !localChanged) {
    return cloudVal;
  }
  if (localChanged && cloudChanged) {
    // Conflict: local wins to protect active typing / edits
    return localVal;
  }
  return baseVal;
}

function mergeBlocks(localBlocks: Block[], cloudBlocks: Block[], baseBlocks: Block[]): Block[] {
  const baseMap = new Map<string, Block>();
  const cloudMap = new Map<string, Block>();
  const localMap = new Map<string, Block>();

  baseBlocks.forEach(b => baseMap.set(b.id, b));
  cloudBlocks.forEach(b => cloudMap.set(b.id, b));
  localBlocks.forEach(b => localMap.set(b.id, b));

  const allIds = Array.from(new Set([
    ...localBlocks.map(b => b.id),
    ...cloudBlocks.map(b => b.id),
    ...baseBlocks.map(b => b.id)
  ]));

  const mergedBlocks: Block[] = [];

  for (const id of allIds) {
    const locB = localMap.get(id);
    const cldB = cloudMap.get(id);
    const basB = baseMap.get(id);

    if (locB && cldB && basB) {
      // Block exists in all three: merge fields and laudas
      const titulo = mergeField(locB.titulo, cldB.titulo, basB.titulo);
      const tipo = locB.tipo; // keep local type
      const laudas = mergeLaudas(locB.laudas, cldB.laudas, basB.laudas);
      mergedBlocks.push({ ...basB, ...cldB, ...locB, id, tipo, titulo, laudas });
    } else if (locB && cldB && !basB) {
      // Block added by both: merge them assuming base is empty
      const titulo = locB.titulo || cldB.titulo;
      const laudas = mergeLaudas(locB.laudas, cldB.laudas, []);
      mergedBlocks.push({ ...cldB, ...locB, id, tipo: locB.tipo, titulo, laudas });
    } else if (locB && !cldB && basB) {
      // Deleted in cloud, exists locally
      // Was it modified locally? If so, keep it (resurrect). Otherwise delete it.
      const modifiedLocally = locB.titulo !== basB.titulo || !isEqualValue(locB.laudas, basB.laudas);
      if (modifiedLocally) {
        mergedBlocks.push(locB);
      }
    } else if (!locB && cldB && basB) {
      // Deleted locally, exists in cloud
      // Was it modified in cloud? If so, keep it (resurrect). Otherwise delete it.
      const modifiedInCloud = cldB.titulo !== basB.titulo || !isEqualValue(cldB.laudas, basB.laudas);
      if (modifiedInCloud) {
        mergedBlocks.push(cldB);
      }
    } else if (locB && !cldB && !basB) {
      // Added locally, not in cloud/base
      mergedBlocks.push(locB);
    } else if (!locB && cldB && !basB) {
      // Added in cloud, not locally/base
      mergedBlocks.push(cldB);
    }
    // if not in local and not in cloud, it was deleted in both, so skip.
  }

  // Preserve order based on local blocks list if possible, or cloud order
  // Create a sorting map based on local index, and fall back to cloud index
  const orderMap = new Map<string, number>();
  localBlocks.forEach((b, idx) => orderMap.set(b.id, idx));
  let fallbackIdx = localBlocks.length;
  cloudBlocks.forEach((b) => {
    if (!orderMap.has(b.id)) {
      orderMap.set(b.id, fallbackIdx++);
    }
  });

  return mergedBlocks.sort((a, b) => {
    const oA = orderMap.get(a.id) ?? 999;
    const oB = orderMap.get(b.id) ?? 999;
    return oA - oB;
  });
}

function mergeLaudas(localLaudas: Lauda[], cloudLaudas: Lauda[], baseLaudas: Lauda[]): Lauda[] {
  const baseMap = new Map<string, Lauda>();
  const cloudMap = new Map<string, Lauda>();
  const localMap = new Map<string, Lauda>();

  baseLaudas.forEach(l => baseMap.set(l.id, l));
  cloudLaudas.forEach(l => cloudMap.set(l.id, l));
  localLaudas.forEach(l => localMap.set(l.id, l));

  const allIds = Array.from(new Set([
    ...localLaudas.map(l => l.id),
    ...cloudLaudas.map(l => l.id),
    ...baseLaudas.map(l => l.id)
  ]));

  const mergedLaudas: Lauda[] = [];

  for (const id of allIds) {
    const locL = localMap.get(id);
    const cldL = cloudMap.get(id);
    const basL = baseMap.get(id);

    if (locL && cldL && basL) {
      // Exists in all three: merge field by field
      const materia = mergeField(locL.materia, cldL.materia, basL.materia);
      const duracao = mergeField(locL.duracao, cldL.duracao, basL.duracao);
      const tipo = mergeField(locL.tipo, cldL.tipo, basL.tipo);
      const apresentador = mergeField(locL.apresentador, cldL.apresentador, basL.apresentador);
      const laudaContent = mergeField(locL.laudaContent, cldL.laudaContent, basL.laudaContent);
      const driveLink = mergeField(locL.driveLink || '', cldL.driveLink || '', basL.driveLink || '');
      const aprovado = mergeField(!!locL.aprovado, !!cldL.aprovado, !!basL.aprovado);
      const gc = mergeField(locL.gc || '', cldL.gc || '', basL.gc || '');
      const gcs = mergeField(locL.gcs || [], cldL.gcs || [], basL.gcs || []);

      mergedLaudas.push({
        ...basL,
        ...cldL,
        ...locL,
        id,
        materia,
        duracao,
        tipo,
        apresentador,
        laudaContent,
        driveLink,
        aprovado,
        gc,
        gcs,
      });
    } else if (locL && cldL && !basL) {
      // Added in both
      const materia = locL.materia || cldL.materia;
      const duracao = locL.duracao || cldL.duracao;
      const tipo = locL.tipo || cldL.tipo;
      const apresentador = locL.apresentador || cldL.apresentador;
      const laudaContent = locL.laudaContent || cldL.laudaContent;
      const driveLink = locL.driveLink || cldL.driveLink;
      const aprovado = locL.aprovado !== undefined ? locL.aprovado : cldL.aprovado;
      const gc = locL.gc !== undefined ? locL.gc : cldL.gc;
      const gcs = (locL.gcs && locL.gcs.length > 0) ? locL.gcs : (cldL.gcs || []);
      mergedLaudas.push({
        ...cldL,
        ...locL,
        id,
        materia,
        duracao,
        tipo,
        apresentador,
        laudaContent,
        driveLink,
        aprovado,
        gc,
        gcs,
      });
    } else if (locL && !cldL && basL) {
      // Deleted in cloud, exists locally
      // Was it modified locally? If so, keep it. Otherwise delete.
      const modifiedLocally = !isLaudaEqual(locL, basL);
      if (modifiedLocally) {
        mergedLaudas.push(locL);
      }
    } else if (!locL && cldL && basL) {
      // Deleted locally, exists in cloud
      // Was it modified in cloud? If so, keep it. Otherwise delete.
      const modifiedInCloud = !isLaudaEqual(cldL, basL);
      if (modifiedInCloud) {
        mergedLaudas.push(cldL);
      }
    } else if (locL && !cldL && !basL) {
      // Added locally
      mergedLaudas.push(locL);
    } else if (!locL && cldL && !basL) {
      // Added in cloud
      mergedLaudas.push(cldL);
    }
  }

  // Preserve order based on local or cloud
  const orderMap = new Map<string, number>();
  localLaudas.forEach((l, idx) => orderMap.set(l.id, idx));
  let fallbackIdx = localLaudas.length;
  cloudLaudas.forEach((l) => {
    if (!orderMap.has(l.id)) {
      orderMap.set(l.id, fallbackIdx++);
    }
  });

  return mergedLaudas.sort((a, b) => {
    const oA = orderMap.get(a.id) ?? 999;
    const oB = orderMap.get(b.id) ?? 999;
    return oA - oB;
  });
}
