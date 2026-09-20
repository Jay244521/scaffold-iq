#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FGWeaponBase.generated.h"

class USkeletalMeshComponent;
class UFGInventoryComponent;

/**
 * Base weapon actor. Fire requests originate on the owning client but the hit trace and
 * damage application run on the server so weapons stay authoritative like the rest of
 * combat; the trace endpoints are network-quantized to keep RPC bandwidth small.
 */
UCLASS()
class FORGEGAMES_API AFGWeaponBase : public AActor
{
	GENERATED_BODY()

public:
	AFGWeaponBase();

	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Weapon")
	virtual void StartFire();

	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Weapon")
	virtual void StopFire();

	/** Called by the inventory component when this weapon becomes the active one. */
	void OnEquipped(APawn* NewOwnerPawn, UFGInventoryComponent* OwningInventory);

	/** Called by the inventory component when this weapon stops being the active one. */
	void OnUnequipped();

	UFUNCTION(BlueprintPure, Category = "ForgeGames|Weapon")
	FName GetWeaponId() const { return WeaponId; }

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Weapon")
	FName WeaponId;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Weapon")
	FName AttachSocketName = TEXT("WeaponSocket");

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Weapon")
	float Damage = 20.f;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Weapon")
	float FireRate = 0.15f;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Weapon")
	float Range = 10000.f;

	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Weapon")
	int32 MagazineSize = 30;

	UPROPERTY(ReplicatedUsing = OnRep_CurrentAmmo, BlueprintReadOnly, Category = "ForgeGames|Weapon")
	int32 CurrentAmmo = 30;

protected:
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	UPROPERTY(VisibleAnywhere, Category = "ForgeGames|Weapon")
	TObjectPtr<USkeletalMeshComponent> WeaponMesh;

	UFUNCTION(Server, Reliable)
	void Server_Fire(const FVector_NetQuantize10& TraceStart, const FVector_NetQuantize10& TraceEnd);

	UFUNCTION()
	void OnRep_CurrentAmmo();

	UPROPERTY()
	TObjectPtr<APawn> OwnerPawn;

	UPROPERTY()
	TObjectPtr<UFGInventoryComponent> OwningInventoryComponent;

private:
	bool GetOwnerAimTrace(FVector& OutStart, FVector& OutEnd) const;

	FTimerHandle FireRateTimerHandle;
	bool bWantsToFire = false;

	void HandleFireTick();
};
