-- 文部科学省の食品成分データを、食品・栄養素・両者の対応に正規化して保存する。
create table foods (
    id bigint generated always as identity primary key,
    food_code text not null unique,
    name text not null,
    food_group_code text not null,
    food_group_name text not null,
    source text not null,
    source_version text not null,
    created_at timestamptz not null default now()
);

-- 栄養素の名称・単位・表示順を一元管理するマスタ。
create table nutrients (
    id bigint generated always as identity primary key,
    code text not null unique,
    name text not null,
    unit text not null,
    category text not null,
    display_order integer not null,
    is_primary boolean not null default false,
    created_at timestamptz not null default now()
);

-- 各食品100g当たりの栄養値と、測定・推定などの値の状態を保持する。
create table food_nutrients (
    food_id bigint not null,
    nutrient_id bigint not null,
    amount numeric,
    value_status text not null,
    raw_value text,
    created_at timestamptz not null default now(),

    primary key (food_id, nutrient_id),

    foreign key (food_id)
        references foods (id)
        on delete cascade,

    foreign key (nutrient_id)
        references nutrients (id)
        on delete cascade,

    -- 未測定値はNULLを許容するが、栄養量として負数は保存しない。
    check (amount is null or amount >= 0),

    check (
        value_status in (
            'measured',
            'estimated',
            'zero',
            'trace',
            'estimated_trace',
            'not_measured',
            'missing'
        )
    )
);

-- 食品マスタは全利用者が読める一方、ブラウザからの変更は許可しない。
alter table foods enable row level security;
alter table nutrients enable row level security;
alter table food_nutrients enable row level security;

revoke all on table foods from anon, authenticated;
revoke all on table nutrients from anon, authenticated;
revoke all on table food_nutrients from anon, authenticated;

grant select on table foods to anon, authenticated;
grant select on table nutrients to anon, authenticated;
grant select on table food_nutrients to anon, authenticated;

create policy "Public read access for foods"
on foods
for select
to anon, authenticated
using (true);

create policy "Public read access for nutrients"
on nutrients
for select
to anon, authenticated
using (true);

create policy "Public read access for food nutrients"
on food_nutrients
for select
to anon, authenticated
using (true);
