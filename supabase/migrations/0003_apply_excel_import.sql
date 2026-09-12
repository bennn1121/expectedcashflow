-- Applies an Excel-import diff (an account-settings patch plus transaction
-- inserts/updates/deletes) as one atomic operation. A single Postgres
-- function call is one transaction, so if any statement fails the whole
-- import rolls back instead of leaving the account half-updated.
--
-- security invoker (the default, made explicit here) means this runs with
-- the calling user's own privileges, so the existing RLS policies on
-- `accounts` and `transactions` still apply exactly as if the caller had
-- issued these statements directly — it cannot touch another user's data.

create or replace function apply_excel_import(
  p_account_id uuid,
  p_account_patch jsonb, -- {name?, currency?, minimum_buffer?, starting_balance_override?} or null
  p_inserts jsonb, -- array of {date, description, amount, source}
  p_updates jsonb, -- array of {id, date, description, amount, source}
  p_delete_ids uuid[]
) returns void
language plpgsql
security invoker
as $$
begin
  if p_account_patch is not null then
    update accounts set
      name = coalesce(p_account_patch->>'name', name),
      currency = coalesce(p_account_patch->>'currency', currency),
      minimum_buffer = coalesce((p_account_patch->>'minimum_buffer')::numeric, minimum_buffer),
      starting_balance_override = case
        when p_account_patch ? 'starting_balance_override'
        then (p_account_patch->>'starting_balance_override')::numeric
        else starting_balance_override
      end
    where id = p_account_id;
  end if;

  if p_delete_ids is not null and array_length(p_delete_ids, 1) > 0 then
    delete from transactions
    where account_id = p_account_id and id = any(p_delete_ids);
  end if;

  if p_updates is not null and jsonb_array_length(p_updates) > 0 then
    update transactions t set
      date = (u->>'date')::date,
      description = u->>'description',
      amount = (u->>'amount')::numeric,
      source = coalesce(u->>'source', t.source)
    from jsonb_array_elements(p_updates) as u
    where t.id = (u->>'id')::uuid and t.account_id = p_account_id;
  end if;

  if p_inserts is not null and jsonb_array_length(p_inserts) > 0 then
    insert into transactions (account_id, date, description, amount, source)
    select
      p_account_id,
      (i->>'date')::date,
      i->>'description',
      (i->>'amount')::numeric,
      coalesce(i->>'source', 'excel')
    from jsonb_array_elements(p_inserts) as i;
  end if;
end;
$$;

grant execute on function apply_excel_import(uuid, jsonb, jsonb, jsonb, uuid[]) to authenticated;
