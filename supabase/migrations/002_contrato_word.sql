-- ============================================================
-- Migração 002 — Geração do Contrato em Word (.docx)
-- Adiciona os campos necessários para preencher o contrato padrão.
-- Segura para rodar mais de uma vez (usa IF NOT EXISTS).
-- ============================================================

-- Representante legal + dados da CONTRATANTE (reutilizáveis por cliente)
alter table contratantes
  add column if not exists rep_nome          text,
  add column if not exists rep_nacionalidade text,
  add column if not exists rep_estado_civil  text,
  add column if not exists rep_profissao     text,
  add column if not exists rep_rg            text,
  add column if not exists rep_cpf           text,
  add column if not exists rep_cidade_uf     text;

-- Campos específicos do contrato usados na geração do documento
alter table contratos
  add column if not exists objeto_resumido        text,
  add column if not exists objeto_municipio_uf    text,
  add column if not exists objeto_vinculacao      text,
  add column if not exists prazo_vigencia_extenso text,
  add column if not exists local_assinatura       text,
  add column if not exists data_assinatura        date;

-- Serviços da Cláusula Primeira (lista flexível: a, b, c, ...)
create table if not exists contrato_servicos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos(id) on delete cascade,
  descricao text not null,
  ordem integer
);
