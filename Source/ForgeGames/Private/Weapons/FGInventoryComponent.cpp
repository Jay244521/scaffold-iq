#include "Weapons/FGInventoryComponent.h"
#include "Weapons/FGWeaponBase.h"
#include "Net/UnrealNetwork.h"
#include "GameFramework/Pawn.h"

UFGInventoryComponent::UFGInventoryComponent()
{
	SetIsReplicatedByDefault(true);
	PrimaryComponentTick.bCanEverTick = false;
}

void UFGInventoryComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(UFGInventoryComponent, Weapons);
	DOREPLIFETIME(UFGInventoryComponent, ActiveWeaponIndex);
}

bool UFGInventoryComponent::AddWeapon(AFGWeaponBase* Weapon)
{
	if (!GetOwner() || !GetOwner()->HasAuthority() || !Weapon || Weapons.Num() >= MaxWeaponSlots)
	{
		return false;
	}

	Weapons.Add(Weapon);

	if (ActiveWeaponIndex == INDEX_NONE)
	{
		EquipWeaponAtIndex(Weapons.Num() - 1);
	}

	return true;
}

bool UFGInventoryComponent::RemoveWeaponAtIndex(int32 Index)
{
	if (!GetOwner() || !GetOwner()->HasAuthority() || !Weapons.IsValidIndex(Index))
	{
		return false;
	}

	AFGWeaponBase* Weapon = Weapons[Index];
	Weapons.RemoveAt(Index);

	if (Weapon)
	{
		Weapon->OnUnequipped();
	}

	if (ActiveWeaponIndex == Index)
	{
		ActiveWeaponIndex = INDEX_NONE;
		if (Weapons.Num() > 0)
		{
			EquipWeaponAtIndex(0);
		}
	}
	else if (ActiveWeaponIndex > Index)
	{
		--ActiveWeaponIndex;
	}

	return true;
}

void UFGInventoryComponent::EquipWeaponAtIndex(int32 Index)
{
	if (!GetOwner() || !GetOwner()->HasAuthority() || !Weapons.IsValidIndex(Index) || Index == ActiveWeaponIndex)
	{
		return;
	}

	if (AFGWeaponBase* CurrentWeapon = GetActiveWeapon())
	{
		CurrentWeapon->OnUnequipped();
	}

	ActiveWeaponIndex = Index;

	if (AFGWeaponBase* NewWeapon = Weapons[ActiveWeaponIndex])
	{
		NewWeapon->OnEquipped(Cast<APawn>(GetOwner()), this);
	}
}

void UFGInventoryComponent::CycleWeapon(int32 Direction)
{
	if (Weapons.Num() <= 1 || Direction == 0)
	{
		return;
	}

	const int32 NumWeapons = Weapons.Num();
	const int32 NextIndex = ((ActiveWeaponIndex + Direction) % NumWeapons + NumWeapons) % NumWeapons;
	EquipWeaponAtIndex(NextIndex);
}

AFGWeaponBase* UFGInventoryComponent::GetActiveWeapon() const
{
	return Weapons.IsValidIndex(ActiveWeaponIndex) ? Weapons[ActiveWeaponIndex].Get() : nullptr;
}

void UFGInventoryComponent::OnRep_Weapons()
{
}

void UFGInventoryComponent::OnRep_ActiveWeaponIndex()
{
}
