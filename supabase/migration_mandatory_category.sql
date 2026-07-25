-- Make category mandatory, default to 'Food & Groceries'
update public.expenses set category = 'Food & Groceries' where category is null or category = '';
alter table public.expenses alter column category set not null;
alter table public.expenses alter column category set default 'Food & Groceries';
