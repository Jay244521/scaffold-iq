#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "FGInventoryComponent.generated.h"

class AFGWeaponBase;

UCLASS(ClassGroup = (ForgeGames), meta = (BlueprintSpawnableComponent))
class FORGEGAMES_API UFGInventoryComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UFGInventoryComponent();

	/** Server-only: adds a weapon to the dynamic loadout. Equips it if nothing else is active. */
	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Inventory")
	bool AddWeapon(AFGWeaponBase* Weapon);

	/** Server-only: removes and drops the weapon at the given slot. */
	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Inventory")
	bool RemoveWeaponAtIndex(int32 Index);

	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Inventory")
	void EquipWeaponAtIndex(int32 Index);

	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Inventory")
	void CycleWeapon(int32 Direction);

	UFUNCTION(BlueprintPure, Category = "ForgeGames|Inventory")
	AFGWeaponBase* GetActiveWeapon() const;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Inventory")
	int32 MaxWeaponSlots = 4;

protected:
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UPROPERTY(ReplicatedUsing = OnRep_Weapons, BlueprintReadOnly, Category = "ForgeGames|Inventory")
	TArray<TObjectPtr<AFGWeaponBase>> Weapons;

	UPROPERTY(ReplicatedUsing = OnRep_ActiveWeaponIndex, BlueprintReadOnly, Category = "ForgeGames|Inventory")
	int32 ActiveWeaponIndex = INDEX_NONE;

	UFUNCTION()
	void OnRep_Weapons();

	UFUNCTION()
	void OnRep_ActiveWeaponIndex();
};
