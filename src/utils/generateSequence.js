async function getNextSequence(tx, companyId, field) {
  const sequence = await tx.companySequence.upsert({
    where: { companyId },
    update: {
      [field]: {
        increment: 1,
      },
    },
    create: {
      companyId,
      [field]: 1,
    },
  });

  return sequence[field];
}

module.exports = { getNextSequence };